import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from_email: string;
  from_name: string;
  secure: boolean;
  to_email: string;
}

interface TestResult {
  success: boolean;
  steps: { label: string; status: "ok" | "fail" | "info"; detail?: string }[];
  error?: string;
  duration_ms: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const started = Date.now();
  const steps: TestResult["steps"] = [];

  try {
    const body: SmtpConfig = await req.json();
    const { host, port, user, pass, from_email, from_name, secure, to_email } = body;

    // ── Step 1: Validate inputs ──────────────────────────────────────────────
    const missing = [];
    if (!host) missing.push("SMTP Host");
    if (!port) missing.push("SMTP Port");
    if (!user) missing.push("SMTP Username");
    if (!pass) missing.push("SMTP Password");
    if (!from_email) missing.push("From Email");
    if (!to_email) missing.push("Recipient Email");

    if (missing.length > 0) {
      steps.push({ label: "Validate configuration", status: "fail", detail: `Missing: ${missing.join(", ")}` });
      return json({ success: false, steps, error: "Missing required fields", duration_ms: Date.now() - started });
    }
    steps.push({
      label: "Validate configuration",
      status: "ok",
      detail: `Host: ${host}:${port} | From: ${from_email} | Secure: ${secure ? "TLS/SSL" : "STARTTLS"}`,
    });

    // ── Step 2: DNS resolution check (TCP connect) ───────────────────────────
    try {
      const conn = await Deno.connect({ hostname: host, port: Number(port) });
      conn.close();
      steps.push({ label: `TCP connect to ${host}:${port}`, status: "ok", detail: "Port is reachable" });
    } catch (e) {
      steps.push({
        label: `TCP connect to ${host}:${port}`,
        status: "fail",
        detail: `Could not reach ${host}:${port} — ${(e as Error).message}`,
      });
      return json({
        success: false,
        steps,
        error: `Cannot connect to ${host}:${port}. Check host/port and firewall.`,
        duration_ms: Date.now() - started,
      });
    }

    // ── Step 3: Send email via SMTP using nodemailer ─────────────────────────
    steps.push({ label: "Load SMTP library", status: "info", detail: "Using npm:nodemailer" });

    const nodemailer = await import("npm:nodemailer@6");

    const transporter = nodemailer.default.createTransport({
      host,
      port: Number(port),
      secure: !!secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: { rejectUnauthorized: false },
    });

    // Verify connection
    try {
      await transporter.verify();
      steps.push({ label: "SMTP authentication", status: "ok", detail: `Logged in as ${user}` });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ label: "SMTP authentication", status: "fail", detail: msg });
      return json({ success: false, steps, error: `Auth failed: ${msg}`, duration_ms: Date.now() - started });
    }

    // Send test email
    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#1B3A6E;margin-bottom:8px;">Test Email — HumanVerse360</h2>
        <p style="color:#555;">This is a test email sent from the Platform Administration panel to verify your SMTP configuration.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <table style="width:100%;font-size:13px;color:#333;">
          <tr><td style="padding:4px 0;color:#888;">SMTP Host</td><td>${host}:${port}</td></tr>
          <tr><td style="padding:4px 0;color:#888;">Security</td><td>${secure ? "TLS/SSL" : "STARTTLS"}</td></tr>
          <tr><td style="padding:4px 0;color:#888;">From</td><td>${from_name ? `${from_name} <${from_email}>` : from_email}</td></tr>
          <tr><td style="padding:4px 0;color:#888;">Sent at</td><td>${new Date().toISOString()}</td></tr>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#aaa;">Sent from HumanVerse360 Platform Admin</p>
      </div>
    `;

    try {
      const info = await transporter.sendMail({
        from: from_name ? `"${from_name}" <${from_email}>` : from_email,
        to: to_email,
        subject: "HumanVerse360 — SMTP Test Email",
        html,
        text: `Test email from HumanVerse360.\n\nSMTP: ${host}:${port}\nFrom: ${from_email}\nSent: ${new Date().toISOString()}`,
      });
      steps.push({
        label: "Send test email",
        status: "ok",
        detail: `Delivered to ${to_email} | Message-ID: ${info.messageId || "n/a"}`,
      });
    } catch (e) {
      const msg = (e as Error).message;
      steps.push({ label: "Send test email", status: "fail", detail: msg });
      return json({ success: false, steps, error: `Send failed: ${msg}`, duration_ms: Date.now() - started });
    }

    return json({ success: true, steps, duration_ms: Date.now() - started });
  } catch (e) {
    steps.push({ label: "Unexpected error", status: "fail", detail: (e as Error).message });
    return json({ success: false, steps, error: (e as Error).message, duration_ms: Date.now() - started });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
