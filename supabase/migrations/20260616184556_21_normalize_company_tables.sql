-- Add company_id to leave_types (nullable = global/shared row, non-null = company-specific)
ALTER TABLE leave_types
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_leave_types_company ON leave_types(company_id);

-- Add company_id to salary_components
ALTER TABLE salary_components
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_salary_components_company ON salary_components(company_id);

-- Add company_id to indemnity_settings
ALTER TABLE indemnity_settings
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_indemnity_settings_company ON indemnity_settings(company_id);

-- ── leave_types RLS ──────────────────────────────────────────────────────────
-- Replace open_select with company-scoped (global rows visible to all companies)
DROP POLICY IF EXISTS open_select ON leave_types;
CREATE POLICY lt_select ON leave_types FOR SELECT TO anon, authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());

-- Fix INSERT: require company_id match + admin role
DROP POLICY IF EXISTS lt_insert ON leave_types;
CREATE POLICY lt_insert ON leave_types FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

-- Fix UPDATE: company_id match + admin role (USING = row filter, WITH CHECK = new value)
DROP POLICY IF EXISTS lt_update ON leave_types;
CREATE POLICY lt_update ON leave_types FOR UPDATE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

-- Fix DELETE: company_id match + admin role
DROP POLICY IF EXISTS lt_delete ON leave_types;
CREATE POLICY lt_delete ON leave_types FOR DELETE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

-- ── salary_components RLS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS open_select ON salary_components;
CREATE POLICY sc_select ON salary_components FOR SELECT TO anon, authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());

DROP POLICY IF EXISTS sc_insert ON salary_components;
CREATE POLICY sc_insert ON salary_components FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS sc_update ON salary_components;
CREATE POLICY sc_update ON salary_components FOR UPDATE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS sc_delete ON salary_components;
CREATE POLICY sc_delete ON salary_components FOR DELETE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

-- ── indemnity_settings RLS ────────────────────────────────────────────────────
DROP POLICY IF EXISTS open_select ON indemnity_settings;
CREATE POLICY indem_select ON indemnity_settings FOR SELECT TO anon, authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());

DROP POLICY IF EXISTS indem_insert ON indemnity_settings;
CREATE POLICY indem_insert ON indemnity_settings FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS indem_update ON indemnity_settings;
CREATE POLICY indem_update ON indemnity_settings FOR UPDATE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  )
  WITH CHECK (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS indem_delete ON indemnity_settings;
CREATE POLICY indem_delete ON indemnity_settings FOR DELETE TO authenticated
  USING (
    company_id = get_current_company_id()
    AND EXISTS (
      SELECT 1 FROM company_users
      WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'
    )
  );
