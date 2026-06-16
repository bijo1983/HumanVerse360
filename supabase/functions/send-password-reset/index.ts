import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email) return json({ success: false, error: "Email is required." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user exists — always return success to prevent email enumeration
    const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const userExists = (usersPage?.users ?? []).some(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );
    if (!userExists) {
      // Silently succeed — don't reveal whether the email exists
      return json({ success: true });
    }

    // Load platform SMTP settings
    const { data: rows } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name", "smtp_enabled"]);

    const smtp = Object.fromEntries(
      (rows || []).map((r: { key: string; value: string }) => [r.key, r.value])
    );

    if (smtp.smtp_enabled !== "true" || !smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
      return json({ success: false, error: "smtp_not_configured" });
    }

    // Generate 6-digit OTP and store it (10-min expiry, purpose = password_reset)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await supabase.from("email_otps").delete().eq("email", email.trim().toLowerCase());
    const { error: insertErr } = await supabase.from("email_otps").insert({
      email: email.trim().toLowerCase(),
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertErr) throw new Error(`Failed to store OTP: ${insertErr.message}`);

    // Send OTP email via platform SMTP
    const nodemailer = await import("npm:nodemailer@6");
    const portNum = Number(smtp.smtp_port) || 587;
    const useSsl = portNum === 465;
    const useStartTls = portNum === 587 || portNum === 2525;

    const transporter = nodemailer.default.createTransport({
      host: smtp.smtp_host,
      port: portNum,
      secure: useSsl,
      requireTLS: useStartTls,
      auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });

    const fromAddr = smtp.smtp_from_name
      ? `"${smtp.smtp_from_name}" <${smtp.smtp_from_email}>`
      : smtp.smtp_from_email;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#0D2554,#1B3A6E);border-radius:12px;padding:10px 20px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;">HumanVerse360</span>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background:#EFF6FF;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">🔑</div>
        </div>
        <h2 style="color:#1B3A6E;text-align:center;font-size:22px;margin:0 0 8px;">Password Reset Code</h2>
        <p style="color:#6B7280;text-align:center;font-size:14px;margin:0 0 28px;line-height:1.6;">
          Enter the code below to reset your HumanVerse360 password.
        </p>
        <div style="background:#F0F4FF;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1B3A6E;font-family:monospace;">${otp}</div>
          <p style="color:#888;font-size:13px;margin-top:8px;">Expires in 10 minutes</p>
        </div>
        <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
          <p style="color:#92400E;font-size:13px;margin:0;text-align:center;">
            If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
        <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;" />
        <p style="color:#D1D5DB;font-size:11px;text-align:center;margin:0;">
          HumanVerse360 — HR &amp; Payroll. Simplified. Intelligent. Secure.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddr,
      to: email.trim(),
      subject: "Your HumanVerse360 Password Reset Code",
      html,
      text: `Your HumanVerse360 password reset code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    });

    return json({ success: true });
  } catch (e) {
    console.error("send-password-reset error:", (e as Error).message);
    return json({ success: false, error: (e as Error).message });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
