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
    const { email, otp, newPassword } = await req.json();
    if (!email || !otp || !newPassword) {
      return json({ success: false, error: "Email, OTP, and new password are required." });
    }
    if (newPassword.length < 8) {
      return json({ success: false, error: "Password must be at least 8 characters." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Verify OTP — check exists and not expired
    const { data: otpRow, error: otpErr } = await supabase
      .from("email_otps")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("otp", otp.trim())
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (otpErr) throw new Error(`OTP lookup failed: ${otpErr.message}`);
    if (!otpRow) {
      return json({ success: false, error: "Invalid or expired code. Please request a new one." });
    }

    // Use generateLink to resolve the user by email (returns user object with id)
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
    });

    if (linkErr || !linkData?.user?.id) {
      return json({ success: false, error: "Could not find the account associated with this email." });
    }

    const userId = linkData.user.id;

    // Update the password
    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateErr) throw new Error(`Password update failed: ${updateErr.message}`);

    // Consume the OTP so it cannot be reused
    await supabase.from("email_otps").delete().eq("email", normalizedEmail);

    return json({ success: true });
  } catch (e) {
    console.error("confirm-password-reset error:", (e as Error).message);
    return json({ success: false, error: (e as Error).message });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
