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
    const body = await req.json();
    const { email, password, companyName, fullName, planId, crNumber, phone, industry, country, countryCode } = body;

    if (!email || !password || !companyName || !planId) {
      return json({ success: false, error: "email, password, companyName, and planId are required" }, 400);
    }

    // All operations use the service-role client — no JWT from browser needed
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate plan
    const { data: plan } = await admin.from("subscription_plans").select("id").eq("id", planId).eq("is_active", true).maybeSingle();
    if (!plan) return json({ success: false, error: "Invalid subscription plan" }, 400);

    // Create (or find existing) auth user via admin API
    let userId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      if (!/already registered|already exists/i.test(createErr.message)) {
        return json({ success: false, error: createErr.message }, 400);
      }
      // Email already exists — look up the user
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users?.find((u) => u.email === email);
      if (!found) return json({ success: false, error: "Could not locate existing account" }, 400);
      userId = found.id;
      // Update password so the subsequent signIn with the new password works
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      userId = created.user.id;
    }

    // Guard: user already linked to a company
    const { data: existingCU } = await admin.from("company_users").select("company_id").eq("user_id", userId).maybeSingle();
    if (existingCU?.company_id) {
      return json({ success: false, error: "This account is already linked to a company. Please log in." }, 400);
    }

    // Insert company
    const { data: company, error: coErr } = await admin.from("companies").insert({
      name: companyName,
      email,
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

    // Link user as admin
    const { error: cuErr } = await admin.from("company_users").insert({
      company_id: company.id,
      user_id: userId,
      full_name: fullName || email,
      email,
      role: "admin",
    });
    if (cuErr) throw new Error(`company_users insert failed: ${cuErr.message}`);

    // Seed default departments
    await admin.from("departments").insert([
      { name: "Human Resources", code: "HR",  company_id: company.id },
      { name: "Finance",         code: "FIN", company_id: company.id },
      { name: "Operations",      code: "OPS", company_id: company.id },
      { name: "Management",      code: "MGT", company_id: company.id },
    ]);

    return json({ success: true });
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
