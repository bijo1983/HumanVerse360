import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const body = await req.json();
    const { userId, companyName, email, fullName, planId, crNumber, phone, industry, country, countryCode } = body;

    if (!userId || !companyName || !email || !planId) {
      return json({ success: false, error: "Missing required fields: userId, companyName, email, planId" }, 400);
    }

    // Direct Postgres connection — bypasses PostgREST and service-role key complications entirely
    sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });

    // Guard: already linked
    const existing = await sql`
      SELECT company_id FROM company_users WHERE user_id = ${userId}::uuid LIMIT 1
    `;
    if (existing.length > 0) {
      return json({ success: false, error: "Account already linked to a company. Please log in." }, 400);
    }

    // Validate plan
    const planRows = await sql`
      SELECT id FROM subscription_plans WHERE id = ${planId}::uuid AND is_active = true LIMIT 1
    `;
    if (planRows.length === 0) {
      return json({ success: false, error: "Invalid subscription plan" }, 400);
    }

    // Insert company
    const [company] = await sql`
      INSERT INTO companies (
        name, email, phone, cr_number, industry,
        country, country_code, subscription_plan_id,
        subscription_status, subscription_start, admin_user_id
      ) VALUES (
        ${companyName}, ${email},
        ${phone || null}, ${crNumber || null}, ${industry || null},
        ${country || null}, ${countryCode || null}, ${planId}::uuid,
        'active', CURRENT_DATE, ${userId}::uuid
      )
      RETURNING id, name
    `;

    // Link admin user
    await sql`
      INSERT INTO company_users (company_id, user_id, full_name, email, role, is_active)
      VALUES (${company.id}, ${userId}::uuid, ${fullName || email}, ${email}, 'admin', true)
    `;

    // Seed default departments
    await sql`
      INSERT INTO departments (name, code, company_id) VALUES
        ('Human Resources', 'HR',  ${company.id}),
        ('Finance',         'FIN', ${company.id}),
        ('Operations',      'OPS', ${company.id}),
        ('Management',      'MGT', ${company.id})
    `;

    return json({ success: true, companyId: company.id, companyName: company.name });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  } finally {
    if (sql) await sql.end();
  }
});
