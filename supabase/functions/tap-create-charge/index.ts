import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TAP_API_BASE = "https://api.tap.company/v2/charges";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY");
    const tapMerchantId = Deno.env.get("TAP_MERCHANT_ID");
    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://humanverse360.net";

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
    const { plan_id, company_id } = body;
    if (!plan_id || !company_id) throw new Error("plan_id and company_id are required");

    // Verify user belongs to this company
    const { data: cu, error: cuError } = await supabase
      .from("company_users")
      .select("role, companies(name, email, phone)")
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

    const companyInfo = cu.companies as { name?: string; email?: string; phone?: string };
    const companyName = companyInfo?.name || "Company";
    const companyEmail = companyInfo?.email || user.email || "";

    // BHD uses 3 decimal places per ISO 4217
    const formattedAmount = Number(plan.price_bhd).toFixed(3);

    const redirectUrl = `${appBaseUrl}/subscription`;

    // Create Tap charge — src_all shows all payment methods on Tap hosted page
    const chargeBody: Record<string, unknown> = {
      amount: formattedAmount,
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
      redirect: { url: redirectUrl },
      post: { url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/tap-webhook` },
    };

    if (tapMerchantId) {
      chargeBody.merchant = { id: tapMerchantId };
    }

    const tapRes = await fetch(TAP_API_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tapSecretKey}`,
        "Content-Type": "application/json",
        lang_code: "en",
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
