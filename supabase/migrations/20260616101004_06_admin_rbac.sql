
-- ============================================================
-- 06: Platform admin RLS bypass + company RBAC
-- ============================================================

-- 1. Helper: is the current user a platform admin?
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
$$;

-- 2. Allow platform admins to read ALL companies
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies FOR SELECT TO authenticated
  USING (
    id = get_current_company_id()
    OR is_platform_admin()
  );

-- Allow platform admins to update any company
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies FOR UPDATE TO authenticated
  USING (
    id = get_current_company_id()
    OR is_platform_admin()
  )
  WITH CHECK (
    id = get_current_company_id()
    OR is_platform_admin()
  );

-- Allow platform admins to read all subscription_plans (already public but make explicit)
-- subscription_plans already has no RLS restrictions, skip.

-- 3. company_user_modules: per-user module access within a company
CREATE TABLE IF NOT EXISTS company_user_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module      text NOT NULL,
  granted_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (company_id, user_id, module)
);

ALTER TABLE company_user_modules ENABLE ROW LEVEL SECURITY;

-- Company admins/managers can read their company's module grants
CREATE POLICY cum_select ON company_user_modules FOR SELECT TO authenticated
  USING (company_id = get_current_company_id());

CREATE POLICY cum_insert ON company_user_modules FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE company_id = get_current_company_id()
        AND user_id = auth.uid()
        AND role IN ('admin', 'manager')
        AND is_active = true
    )
  );

CREATE POLICY cum_delete ON company_user_modules FOR DELETE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE company_id = get_current_company_id()
        AND user_id = auth.uid()
        AND role IN ('admin', 'manager')
        AND is_active = true
    )
  );

-- 4. Allow platform admins to read ALL company_users (for admin portal)
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cu_select ON company_users;
CREATE POLICY cu_select ON company_users FOR SELECT TO authenticated
  USING (
    company_id = get_current_company_id()
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS cu_insert ON company_users;
CREATE POLICY cu_insert ON company_users FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_current_company_id()
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS cu_update ON company_users;
CREATE POLICY cu_update ON company_users FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());

DROP POLICY IF EXISTS cu_delete ON company_users;
CREATE POLICY cu_delete ON company_users FOR DELETE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users cu2
      WHERE cu2.company_id = get_current_company_id()
        AND cu2.user_id = auth.uid()
        AND cu2.role = 'admin'
    )
  );

-- 5. Allow platform admins to fully manage subscription_plans
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sp_select ON subscription_plans;
CREATE POLICY sp_select ON subscription_plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sp_public_select ON subscription_plans;
CREATE POLICY sp_public_select ON subscription_plans FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS sp_insert ON subscription_plans;
CREATE POLICY sp_insert ON subscription_plans FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS sp_update ON subscription_plans;
CREATE POLICY sp_update ON subscription_plans FOR UPDATE TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS sp_delete ON subscription_plans;
CREATE POLICY sp_delete ON subscription_plans FOR DELETE TO authenticated
  USING (is_platform_admin());

-- 6. Add full_name + email columns to company_users for display
ALTER TABLE company_users
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Populate email from auth.users for existing rows where possible
UPDATE company_users cu
SET email = au.email
FROM auth.users au
WHERE cu.user_id = au.id AND cu.email IS NULL;
