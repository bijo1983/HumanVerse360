
-- ============================================================
-- 09: Custom fields per module (country/company configurable)
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_fields (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module       text NOT NULL,           -- 'employees', 'leave', 'payroll', etc.
  section      text NOT NULL DEFAULT 'General', -- tab/section label inside the form
  field_key    text NOT NULL,           -- snake_case key stored in JSON
  field_label  text NOT NULL,           -- displayed label
  field_type   text NOT NULL DEFAULT 'text', -- text | number | date | select | checkbox | textarea
  options      jsonb,                   -- for field_type=select: ["Option A","Option B"]
  is_required  boolean NOT NULL DEFAULT false,
  placeholder  text,
  hint         text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  -- Scope: null means global (all countries / all companies)
  country_code text,                    -- ISO 3166-1 alpha-2, null = all countries
  company_id   uuid REFERENCES companies(id) ON DELETE CASCADE, -- null = all companies
  created_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (module, field_key, country_code, company_id)
);

ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;

-- Platform admins can do everything
CREATE POLICY cf_admin_all ON custom_fields FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Company users can read fields applicable to them (global or their country/company)
CREATE POLICY cf_company_read ON custom_fields FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      company_id IS NULL
      OR company_id = get_current_company_id()
    )
  );

-- Seed built-in Bahrain-specific fields
INSERT INTO custom_fields (module, section, field_key, field_label, field_type, is_required, country_code, sort_order, hint) VALUES
  ('employees', 'Personal', 'cpr_number',       'CPR Number',          'text',   true,  'BH', 1,  '9-digit Bahrain Central Population Registry number'),
  ('employees', 'Documents','cpr_expiry',        'CPR Expiry Date',     'date',   false, 'BH', 2,  NULL),
  ('employees', 'Personal', 'gosi_number',       'GOSI Number',         'text',   false, 'BH', 3,  'General Organisation for Social Insurance'),
  ('employees', 'Personal', 'lmra_id',           'LMRA ID',             'text',   false, 'BH', 4,  'Labour Market Regulatory Authority'),
-- UAE-specific
  ('employees', 'Personal', 'emirates_id',       'Emirates ID',         'text',   true,  'AE', 1,  '15-digit Emirates Identity Authority number'),
  ('employees', 'Documents','emirates_id_expiry','Emirates ID Expiry',  'date',   false, 'AE', 2,  NULL),
  ('employees', 'Personal', 'uid_number',        'UID Number',          'text',   false, 'AE', 3,  'Unified Identity Number'),
-- Saudi Arabia
  ('employees', 'Personal', 'iqama_number',      'Iqama / National ID', 'text',   true,  'SA', 1,  'Saudi residency permit or national ID'),
  ('employees', 'Documents','iqama_expiry',       'Iqama Expiry Date',   'date',   false, 'SA', 2,  NULL),
  ('employees', 'Personal', 'gosi_id_sa',         'GOSI ID (KSA)',       'text',   false, 'SA', 3,  'Saudi GOSI registration number'),
-- Kuwait
  ('employees', 'Personal', 'civil_id',          'Civil ID',            'text',   true,  'KW', 1,  'Kuwait Civil ID number'),
  ('employees', 'Documents','civil_id_expiry',    'Civil ID Expiry',     'date',   false, 'KW', 2,  NULL)
ON CONFLICT DO NOTHING;

-- Table to store custom field values per employee
CREATE TABLE IF NOT EXISTS employee_custom_values (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  custom_field_id  uuid NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (employee_id, custom_field_id)
);

ALTER TABLE employee_custom_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY ecv_select ON employee_custom_values FOR SELECT TO authenticated
  USING (company_id = get_current_company_id());
CREATE POLICY ecv_insert ON employee_custom_values FOR INSERT TO authenticated
  WITH CHECK (company_id = get_current_company_id());
CREATE POLICY ecv_update ON employee_custom_values FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());
CREATE POLICY ecv_delete ON employee_custom_values FOR DELETE TO authenticated
  USING (company_id = get_current_company_id());

-- Add country column to companies if not exists
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country_code text DEFAULT 'BH';
-- Update existing companies
UPDATE companies SET country_code = 'BH' WHERE country_code IS NULL;
