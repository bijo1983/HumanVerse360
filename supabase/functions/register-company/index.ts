import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

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

  const pool = new Pool(Deno.env.get("SUPABASE_DB_URL")!, 1, true);

  try {
    const body = await req.json();
    const { userId, companyName, email, fullName, planId, crNumber, phone, industry, country, countryCode } = body;

    if (!userId || !companyName || !email || !planId) {
      return json({ success: false, error: "Missing required fields: userId, companyName, email, planId" }, 400);
    }

    const db = await pool.connect();

    try {
      // Disable RLS for this transaction — we are the service/superuser connection
      await db.queryArray("SET LOCAL row_security = off");

      // Guard: already linked
      const existing = await db.queryArray(
        "SELECT company_id FROM company_users WHERE user_id = $1 LIMIT 1",
        [userId]
      );
      if (existing.rows.length > 0) {
        return json({ success: false, error: "Account already linked to a company. Please log in." }, 400);
      }

      // Validate plan
      const planRows = await db.queryArray(
        "SELECT id FROM subscription_plans WHERE id = $1 AND is_active = true LIMIT 1",
        [planId]
      );
      if (planRows.rows.length === 0) {
        return json({ success: false, error: "Invalid subscription plan" }, 400);
      }

      // Insert company
      const companyResult = await db.queryObject<{ id: string; name: string }>(
        `INSERT INTO companies (name, email, phone, cr_number, industry, country, country_code,
           subscription_plan_id, subscription_status, subscription_start, admin_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid,'active',CURRENT_DATE,$9::uuid)
         RETURNING id, name`,
        [companyName, email, phone ?? null, crNumber ?? null, industry ?? null,
         country ?? null, countryCode ?? null, planId, userId]
      );
      const company = companyResult.rows[0];

      // Link admin user
      await db.queryArray(
        `INSERT INTO company_users (company_id, user_id, full_name, email, role, is_active)
         VALUES ($1,$2::uuid,$3,$4,'admin',true)`,
        [company.id, userId, fullName || email, email]
      );

      // Seed default departments
      await db.queryArray(
        `INSERT INTO departments (name, code, company_id) VALUES
         ('Human Resources','HR',$1),('Finance','FIN',$1),
         ('Operations','OPS',$1),('Management','MGT',$1)`,
        [company.id]
      );

      return json({ success: true, companyId: company.id, companyName: company.name });
    } finally {
      db.release();
    }
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 500);
  } finally {
    await pool.end();
  }
});
