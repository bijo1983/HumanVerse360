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
    const { email, otp } = await req.json();
    if (!email || !otp) return json({ valid: false, error: "Email and code are required." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data } = await supabase
      .from("email_otps")
      .select("id, expires_at, used_at")
      .eq("email", email)
      .eq("otp", otp)
      .maybeSingle();

    if (!data) return json({ valid: false, error: "Invalid verification code." });
    if (data.used_at) return json({ valid: false, error: "This code has already been used." });
    if (new Date(data.expires_at) < new Date()) return json({ valid: false, error: "Verification code has expired. Please request a new one." });

    await supabase.from("email_otps").update({ used_at: new Date().toISOString() }).eq("id", data.id);

    return json({ valid: true });
  } catch (e) {
    return json({ valid: false, error: (e as Error).message });
  }
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
