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
    const { email, redirectTo } = await req.json();
    if (!email) return json({ success: false, error: "Email is required." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Generate a Supabase recovery link using admin API.
    // We always return success to the caller regardless of whether the email exists
    // (prevents email enumeration).
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: { redirectTo: redirectTo || "" },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Log server-side but silently succeed to the client
      console.error("generateLink:", linkError?.message ?? "no action_link");
      return json({ success: true });
    }

    const resetLink = linkData.properties.action_link;

    // Send via platform SMTP
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
        <!-- Header -->
        <div style="text-align:center;margin-bottom:28px;">
          <div style="display:inline-block;background:linear-gradient(135deg,#0D2554,#1B3A6E);border-radius:12px;padding:10px 20px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;">HumanVerse360</span>
          </div>
        </div>

        <!-- Icon -->
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background:#EFF6FF;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px;">🔑</div>
        </div>

        <!-- Title -->
        <h2 style="color:#1B3A6E;text-align:center;font-size:22px;margin:0 0 8px;">Reset Your Password</h2>
        <p style="color:#6B7280;text-align:center;font-size:14px;margin:0 0 28px;line-height:1.6;">
          We received a request to reset the password for your HumanVerse360 account.
          Click the button below to set a new password.
        </p>

        <!-- CTA Button -->
        <div style="text-align:center;margin-bottom:28px;">
          <a href="${resetLink}"
             style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#1B3A6E,#2563EB);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.3px;">
            Reset Password
          </a>
        </div>

        <!-- Expiry notice -->
        <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
          <p style="color:#92400E;font-size:13px;margin:0;text-align:center;">
            ⏱ This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>

        <!-- Fallback link -->
        <p style="color:#9CA3AF;font-size:12px;text-align:center;margin-bottom:4px;">
          If the button doesn't work, copy and paste this URL into your browser:
        </p>
        <p style="color:#6B7280;font-size:11px;text-align:center;word-break:break-all;margin-bottom:24px;">
          ${resetLink}
        </p>

        <hr style="border:none;border-top:1px solid #E5E7EB;margin:20px 0;" />
        <p style="color:#D1D5DB;font-size:11px;text-align:center;margin:0;">
          HumanVerse360 — HR &amp; Payroll. Simplified. Intelligent. Secure.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: fromAddr,
      to: email.trim(),
      subject: "Reset Your HumanVerse360 Password",
      html,
      text: `Reset your HumanVerse360 password by visiting this link:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you did not request this, ignore this email.`,
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
