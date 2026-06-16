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

    // Load SMTP settings
    const { data: rows } = await supabase
      .from("platform_settings")
      .select("key,value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from_email", "smtp_from_name", "smtp_secure", "smtp_enabled"]);

    const smtp = Object.fromEntries((rows || []).map((r: { key: string; value: string }) => [r.key, r.value]));

    if (smtp.smtp_enabled !== "true") {
      return json({ success: false, error: "Platform email is not enabled. Contact the system administrator." });
    }
    if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_pass) {
      return json({ success: false, error: "Platform SMTP is not fully configured. Contact the system administrator." });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    // Delete any previous unused OTPs for this email
    await supabase.from("email_otps").delete().eq("email", email);

    // Store new OTP (10-min expiry)
    const { error: insertErr } = await supabase.from("email_otps").insert({
      email,
      otp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertErr) throw new Error(`Failed to store OTP: ${insertErr.message}`);

    // Build nodemailer transporter
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
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#fff;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#1B3A6E;border-radius:12px;padding:10px 16px;">
            <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:1px;">HumanVerse360</span>
          </div>
        </div>
        <h2 style="color:#1B3A6E;text-align:center;margin-bottom:8px;">Email Verification</h2>
        <p style="color:#555;text-align:center;margin-bottom:28px;">Use the code below to verify your email address and complete your company registration.</p>
        <div style="background:#F0F4FF;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:40px;font-weight:800;letter-spacing:12px;color:#1B3A6E;font-family:monospace;">${otp}</div>
          <p style="color:#888;font-size:13px;margin-top:8px;">Expires in 10 minutes</p>
        </div>
        <p style="color:#999;font-size:12px;text-align:center;">If you did not request this code, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#bbb;font-size:11px;text-align:center;">HumanVerse360 — Secure HR Platform</p>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddr,
      to: email,
      subject: "Your HumanVerse360 Verification Code",
      html,
      text: `Your HumanVerse360 verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
    });

    return json({ success: true });
  } catch (e) {
    return json({ success: false, error: (e as Error).message });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
