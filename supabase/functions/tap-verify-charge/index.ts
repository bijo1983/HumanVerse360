import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY");
    if (!tapSecretKey) throw new Error("TAP_SECRET_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { charge_id } = body;
    if (!charge_id) throw new Error("charge_id is required");

    // Retrieve charge from Tap
    const tapRes = await fetch(`https://api.tap.company/v2/charges/${charge_id}`, {
      headers: { Authorization: `Bearer ${tapSecretKey}` },
    });

    const tapData = await tapRes.json();
    if (!tapRes.ok) {
      const errMsg = tapData?.errors?.[0]?.description || tapData?.message || "Tap API error";
      throw new Error(errMsg);
    }

    const status = tapData.status; // INITIATED | CAPTURED | FAILED | CANCELLED | etc.

    // Find the transaction record in our DB
    const { data: txn } = await supabase
      .from("payment_transactions")
      .select("id, company_id, plan_id, status")
      .eq("charge_id", charge_id)
      .maybeSingle();

    if (!txn) throw new Error("Transaction not found");

    // Verify the company belongs to this user
    const { data: cu } = await supabase
      .from("company_users")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("company_id", txn.company_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!cu) throw new Error("Access denied");

    // Update our transaction record
    await supabase
      .from("payment_transactions")
      .update({ status, tap_response: tapData, updated_at: new Date().toISOString() })
      .eq("id", txn.id);

    // If captured, activate the subscription
    if (status === "CAPTURED" && txn.plan_id) {
      await supabase
        .from("companies")
        .update({
          subscription_plan_id: txn.plan_id,
          subscription_status: "active",
          subscription_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", txn.company_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status,
        captured: status === "CAPTURED",
        plan_id: txn.plan_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
