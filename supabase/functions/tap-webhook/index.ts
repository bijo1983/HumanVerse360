import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TAP_API_BASE = "https://api.tap.company/v2/charges";

// Currency decimal precision per ISO 4217
const CURRENCY_DECIMALS: Record<string, number> = {
  BHD: 3, KWD: 3, OMR: 3, JOD: 3,
  AED: 2, SAR: 2, QAR: 2, USD: 2, EUR: 2, GBP: 2, EGP: 2,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const tapSecretKey = Deno.env.get("TAP_SECRET_KEY");
    if (!tapSecretKey) throw new Error("TAP_SECRET_KEY is not configured");

    const body = await req.json();
    const chargeId = body.id;
    if (!chargeId) throw new Error("Missing charge id in webhook payload");

    // Verify hashstring for security
    const receivedHash = req.headers.get("hashstring") || "";
    const currency = body.currency || "BHD";
    const decimals = CURRENCY_DECIMALS[currency] ?? 2;
    const roundedAmount = Number(body.amount).toFixed(decimals);

    const gatewayRef = body.reference?.gateway || "";
    const paymentRef = body.reference?.payment || "";
    const created = body.transaction?.created || "";

    const hashInput = tapSecretKey + chargeId + roundedAmount + currency + gatewayRef + paymentRef + body.status + created;
    const computedHash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(hashInput)
    );
    const hashHex = Array.from(new Uint8Array(computedHash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (receivedHash && hashHex !== receivedHash) {
      console.error("Webhook hashstring mismatch", { received: receivedHash, computed: hashHex });
      return new Response(JSON.stringify({ error: "Hash verification failed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for server-to-server update
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const status = body.status;

    // Find and update the transaction
    const { data: txn } = await supabase
      .from("payment_transactions")
      .select("id, company_id, plan_id, status")
      .eq("charge_id", chargeId)
      .maybeSingle();

    if (txn) {
      await supabase
        .from("payment_transactions")
        .update({ status, tap_response: body, updated_at: new Date().toISOString() })
        .eq("id", txn.id);

      // If captured, activate the subscription
      if (status === "CAPTURED" && txn.plan_id) {
        const now = new Date();
        const nextBilling = new Date(now);
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await supabase
          .from("companies")
          .update({
            subscription_plan_id: txn.plan_id,
            subscription_status: "active",
            subscription_start: now.toISOString().split("T")[0],
            next_billing_date: nextBilling.toISOString().split("T")[0],
            last_payment_date: now.toISOString().split("T")[0],
            updated_at: now.toISOString(),
          })
          .eq("id", txn.company_id);
      }
    }

    return new Response(JSON.stringify({ success: true, status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", (err as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
