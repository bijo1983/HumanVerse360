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
    const tapMerchantId = Deno.env.get("TAP_MERCHANT_ID");
    if (!tapSecretKey) throw new Error("TAP_SECRET_KEY is not configured");

    // Authenticate the caller
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
    const { plan_id, company_id } = body;
    if (!plan_id || !company_id) throw new Error("plan_id and company_id are required");

    // Verify user belongs to this company
    const { data: cu, error: cuError } = await supabase
      .from("company_users")
      .select("role, companies(name, email)")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .eq("is_active", true)
      .maybeSingle();
    if (cuError || !cu) throw new Error("Company access denied");

    // Fetch plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, name, price_bhd, code")
      .eq("id", plan_id)
      .single();
    if (planError || !plan) throw new Error("Plan not found");
    if (!plan.price_bhd || plan.price_bhd <= 0) throw new Error("Free plans do not require payment");

    const companyName = (cu.companies as { name?: string; email?: string })?.name || "Company";
    const companyEmail = (cu.companies as { name?: string; email?: string })?.email || user.email || "";

    const redirectUrl = `https://humanverse360.net/subscription?tap_id={charge.id}`;

    // Create Tap charge — src_all shows all payment methods on Tap hosted page
    const chargeBody: Record<string, unknown> = {
      amount: plan.price_bhd,
      currency: "BHD",
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: `HumanVerse360 - ${plan.name} Plan`,
      metadata: {
        company_id,
        plan_id,
        plan_code: plan.code,
      },
      reference: {
        transaction: `txn_${company_id.slice(0, 8)}`,
        order: `ord_${plan.code}_${Date.now()}`,
      },
      receipt: { email: true, sms: false },
      customer: {
        first_name: companyName.split(" ")[0] || companyName,
        last_name: companyName.split(" ").slice(1).join(" ") || ".",
        email: companyEmail,
      },
      source: { id: "src_all" },
      redirect: { url: "https://humanverse360.net/subscription" },
    };

    if (tapMerchantId) {
      chargeBody.merchant = { id: tapMerchantId };
    }

    const tapRes = await fetch("https://api.tap.company/v2/charges", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tapSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chargeBody),
    });

    const tapData = await tapRes.json();

    if (!tapRes.ok) {
      const errMsg = tapData?.errors?.[0]?.description || tapData?.message || "Tap API error";
      throw new Error(errMsg);
    }

    // Log transaction in DB
    await supabase.from("payment_transactions").insert({
      company_id,
      plan_id,
      charge_id: tapData.id,
      amount: plan.price_bhd,
      currency: "BHD",
      status: tapData.status || "INITIATED",
      tap_response: tapData,
    });

    return new Response(
      JSON.stringify({
        success: true,
        charge_id: tapData.id,
        checkout_url: tapData.transaction?.url,
        status: tapData.status,
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
