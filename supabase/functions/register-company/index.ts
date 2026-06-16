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
    // Verify caller is authenticated — extract uid from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return json({ success: false, error: "Invalid session" }, 401);

    const userId = user.id;
    const userEmail = user.email!;

    const body = await req.json();
    const { companyName, fullName, planId, crNumber, phone, industry, country, countryCode } = body;

    if (!companyName || !planId) return json({ success: false, error: "companyName and planId are required" }, 400);

    // Use service-role client to bypass RLS for all inserts
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check the plan exists
    const { data: plan } = await admin.from("subscription_plans").select("id").eq("id", planId).maybeSingle();
    if (!plan) return json({ success: false, error: "Invalid plan selected" }, 400);

    // Insert company
    const { data: company, error: coErr } = await admin.from("companies").insert({
      name: companyName,
      email: userEmail,
      phone: phone || null,
      cr_number: crNumber || null,
      industry: industry || null,
      country: country || null,
      country_code: countryCode || null,
      subscription_plan_id: planId,
      subscription_status: "active",
      subscription_start: new Date().toISOString().split("T")[0],
      admin_user_id: userId,
    }).select("id, name").single();
    if (coErr) throw new Error(`Company insert failed: ${coErr.message}`);

    // Insert company_user (admin role)
    const { error: cuErr } = await admin.from("company_users").insert({
      company_id: company.id,
      user_id: userId,
      full_name: fullName || userEmail,
      email: userEmail,
      role: "admin",
    });
    if (cuErr) throw new Error(`company_users insert failed: ${cuErr.message}`);

    // Seed default departments
    await admin.from("departments").insert([
      { name: "Human Resources", code: "HR", company_id: company.id },
      { name: "Finance", code: "FIN", company_id: company.id },
      { name: "Operations", code: "OPS", company_id: company.id },
      { name: "Management", code: "MGT", company_id: company.id },
    ]);

    return json({ success: true, company });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
