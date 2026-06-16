/*
# Extended HR Tables — Lookups, Education, Work History, Dependents, Admin

## Summary
Adds configurable lookup tables, extended employee detail tables, and platform admin support.

## New Tables
- `platform_admins`: email list of super-admins who manage all companies
- `setting_lookups`: generic per-company (or global) lookup values — nationalities, countries, banks, license types, qualifications
- `employee_number_config`: per-company employee ID generation rules (prefix, numbering, year/month inclusion)
- `employee_education`: employee education / qualification history
- `employee_work_history`: previous employment records
- `employee_dependents`: family / dependent records with documents

## Modified Tables
- `companies`: adds `payment_status`, `payment_notes`, `last_payment_date`, `next_billing_date`

## Security
- RLS enabled on all new tables
- `setting_lookups`: authenticated users read global (company_id IS NULL) rows AND their own company rows; write restricted to own company
- All employee detail tables: company-scoped CRUD

## Notes
- Global lookups (nationality, country) are seeded with company_id = NULL
- Admin user admin@humanverse360.com is created in auth.users
*/

-- ─── platform_admins ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_platform_admins" ON platform_admins;
CREATE POLICY "read_platform_admins" ON platform_admins FOR SELECT TO authenticated USING (true);

-- ─── setting_lookups ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS setting_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = global
  lookup_type text NOT NULL,   -- 'nationality','country','bank','license_type','qualification_type'
  code text,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lookups_global ON setting_lookups(lookup_type, name) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_lookups_company ON setting_lookups(company_id, lookup_type, name) WHERE company_id IS NOT NULL;
ALTER TABLE setting_lookups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_setting_lookups" ON setting_lookups;
CREATE POLICY "select_setting_lookups" ON setting_lookups FOR SELECT TO authenticated, anon
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS "insert_setting_lookups" ON setting_lookups;
CREATE POLICY "insert_setting_lookups" ON setting_lookups FOR INSERT TO authenticated
  WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "update_setting_lookups" ON setting_lookups;
CREATE POLICY "update_setting_lookups" ON setting_lookups FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "delete_setting_lookups" ON setting_lookups;
CREATE POLICY "delete_setting_lookups" ON setting_lookups FOR DELETE TO authenticated
  USING (company_id = get_current_company_id());

-- ─── employee_number_config ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_number_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE UNIQUE NOT NULL,
  prefix text DEFAULT 'EMP',
  separator text DEFAULT '',
  include_year boolean DEFAULT false,
  include_month boolean DEFAULT false,
  pad_length int DEFAULT 4,
  starting_number int DEFAULT 1001,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE employee_number_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_emp_num_config" ON employee_number_config;
CREATE POLICY "select_emp_num_config" ON employee_number_config FOR SELECT TO authenticated
  USING (company_id = get_current_company_id());
DROP POLICY IF EXISTS "insert_emp_num_config" ON employee_number_config;
CREATE POLICY "insert_emp_num_config" ON employee_number_config FOR INSERT TO authenticated
  WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "update_emp_num_config" ON employee_number_config;
CREATE POLICY "update_emp_num_config" ON employee_number_config FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

-- ─── employee_education ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  qualification_type text,
  institution_name text,
  field_of_study text,
  country text,
  year_completed int,
  grade text,
  is_verified boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_education ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_employee_education" ON employee_education;
CREATE POLICY "select_employee_education" ON employee_education FOR SELECT TO authenticated USING (company_id = get_current_company_id());
DROP POLICY IF EXISTS "insert_employee_education" ON employee_education;
CREATE POLICY "insert_employee_education" ON employee_education FOR INSERT TO authenticated WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "update_employee_education" ON employee_education;
CREATE POLICY "update_employee_education" ON employee_education FOR UPDATE TO authenticated USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "delete_employee_education" ON employee_education;
CREATE POLICY "delete_employee_education" ON employee_education FOR DELETE TO authenticated USING (company_id = get_current_company_id());

-- ─── employee_work_history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_work_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  employer_name text NOT NULL,
  position text,
  department text,
  start_date date,
  end_date date,
  country text,
  last_salary numeric(12,3),
  reason_for_leaving text,
  reference_name text,
  reference_contact text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_work_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_employee_work_history" ON employee_work_history;
CREATE POLICY "select_employee_work_history" ON employee_work_history FOR SELECT TO authenticated USING (company_id = get_current_company_id());
DROP POLICY IF EXISTS "insert_employee_work_history" ON employee_work_history;
CREATE POLICY "insert_employee_work_history" ON employee_work_history FOR INSERT TO authenticated WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "update_employee_work_history" ON employee_work_history;
CREATE POLICY "update_employee_work_history" ON employee_work_history FOR UPDATE TO authenticated USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "delete_employee_work_history" ON employee_work_history;
CREATE POLICY "delete_employee_work_history" ON employee_work_history FOR DELETE TO authenticated USING (company_id = get_current_company_id());

-- ─── employee_dependents ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employee_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  full_name text NOT NULL,
  relationship text,
  date_of_birth date,
  gender text,
  nationality text,
  passport_number text,
  passport_expiry date,
  passport_issue_country text,
  cpr_number text,
  cpr_expiry date,
  qualification text,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE employee_dependents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_employee_dependents" ON employee_dependents;
CREATE POLICY "select_employee_dependents" ON employee_dependents FOR SELECT TO authenticated USING (company_id = get_current_company_id());
DROP POLICY IF EXISTS "insert_employee_dependents" ON employee_dependents;
CREATE POLICY "insert_employee_dependents" ON employee_dependents FOR INSERT TO authenticated WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "update_employee_dependents" ON employee_dependents;
CREATE POLICY "update_employee_dependents" ON employee_dependents FOR UPDATE TO authenticated USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS "delete_employee_dependents" ON employee_dependents;
CREATE POLICY "delete_employee_dependents" ON employee_dependents FOR DELETE TO authenticated USING (company_id = get_current_company_id());

-- ─── companies — payment columns ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='payment_status') THEN
    ALTER TABLE companies ADD COLUMN payment_status text DEFAULT 'unpaid';
    ALTER TABLE companies ADD COLUMN payment_notes text;
    ALTER TABLE companies ADD COLUMN last_payment_date date;
    ALTER TABLE companies ADD COLUMN next_billing_date date;
  END IF;
END $$;

-- ─── platform admin record ───────────────────────────────────────────────────
INSERT INTO platform_admins (email, full_name)
VALUES ('admin@humanverse360.com', 'Platform Admin')
ON CONFLICT (email) DO NOTHING;

-- ─── create admin auth user ───────────────────────────────────────────────────
DO $$
DECLARE v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@humanverse360.com';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      'admin@humanverse360.com', crypt('jU@Nj@1DEN', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Platform Admin"}',
      false, '', '', '', ''
    );
    INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), 'admin@humanverse360.com', v_uid,
      json_build_object('sub', v_uid::text, 'email', 'admin@humanverse360.com'),
      'email', now(), now(), now());
  END IF;
END $$;

-- ─── global lookups — nationalities ──────────────────────────────────────────
INSERT INTO setting_lookups (company_id, lookup_type, name, code, sort_order) VALUES
(NULL,'nationality','Bahraini','BH',1),(NULL,'nationality','Indian','IN',2),
(NULL,'nationality','Pakistani','PK',3),(NULL,'nationality','Bangladeshi','BD',4),
(NULL,'nationality','Filipino','PH',5),(NULL,'nationality','Nepalese','NP',6),
(NULL,'nationality','Sri Lankan','LK',7),(NULL,'nationality','Egyptian','EG',8),
(NULL,'nationality','Jordanian','JO',9),(NULL,'nationality','Lebanese','LB',10),
(NULL,'nationality','Syrian','SY',11),(NULL,'nationality','Yemeni','YE',12),
(NULL,'nationality','Saudi Arabian','SA',13),(NULL,'nationality','Emirati','AE',14),
(NULL,'nationality','Kuwaiti','KW',15),(NULL,'nationality','Omani','OM',16),
(NULL,'nationality','Qatari','QA',17),(NULL,'nationality','American','US',18),
(NULL,'nationality','British','GB',19),(NULL,'nationality','Indonesian','ID',20),
(NULL,'nationality','Ethiopian','ET',21),(NULL,'nationality','Chinese','CN',22),
(NULL,'nationality','Other','OT',99)
ON CONFLICT (lookup_type, name) WHERE company_id IS NULL DO NOTHING;

-- ─── global lookups — countries ───────────────────────────────────────────────
INSERT INTO setting_lookups (company_id, lookup_type, name, code, sort_order) VALUES
(NULL,'country','Bahrain','BH',1),(NULL,'country','India','IN',2),
(NULL,'country','Pakistan','PK',3),(NULL,'country','Bangladesh','BD',4),
(NULL,'country','Philippines','PH',5),(NULL,'country','Nepal','NP',6),
(NULL,'country','Sri Lanka','LK',7),(NULL,'country','Egypt','EG',8),
(NULL,'country','Jordan','JO',9),(NULL,'country','Lebanon','LB',10),
(NULL,'country','Saudi Arabia','SA',11),(NULL,'country','United Arab Emirates','AE',12),
(NULL,'country','Kuwait','KW',13),(NULL,'country','Oman','OM',14),
(NULL,'country','Qatar','QA',15),(NULL,'country','United States','US',16),
(NULL,'country','United Kingdom','GB',17),(NULL,'country','Indonesia','ID',18),
(NULL,'country','China','CN',19),(NULL,'country','Ethiopia','ET',20),
(NULL,'country','Other','OT',99)
ON CONFLICT (lookup_type, name) WHERE company_id IS NULL DO NOTHING;
