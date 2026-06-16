
/*
# Multi-Tenancy: Companies, Subscriptions & Company-Scoped Data

## Overview
Adds full multi-tenant support to Humanverse360. Each company registers
independently with its own subscription tier. All operational data is
isolated per company via RLS using a helper function.

## New Tables

### subscription_plans
Defines the four pricing tiers:
- free: Employee management + notifications only, max 10 employees, BHD 0/month
- small: All modules, max 25 employees, BHD 20/month
- medium: All modules, max 100 employees, BHD 50/month
- large: All modules, unlimited employees, BHD 250/month

### companies
Registered company profiles with subscription details.

### company_users
Links Supabase auth users to companies with role (admin/manager/hr/viewer).

## Schema Changes to Existing Tables
Adds `company_id` column (nullable FK to companies) to:
- departments, positions, employees
- leave_requests, leave_balances, employee_documents
- payroll_runs, payroll_line_items, system_notifications

## Helper Function
`get_current_company_id()` - Returns the company_id for the authenticated user
via the company_users junction table. Used in all RLS policies.

## Security
- subscription_plans: readable by anon + authenticated (needed for registration page)
- companies: authenticated users can read/update their own company
- company_users: authenticated users can read their own membership
- All operational tables: scoped to the authenticated user's company via get_current_company_id()
- Global/shared tables (leave_types, salary_components, calculation_settings, indemnity_settings)
  remain open as they have no company_id (shared system defaults)

## Notes
1. existing payroll_runs UNIQUE(month, year) constraint is dropped and replaced
   with UNIQUE(company_id, month, year) to allow multiple companies per period
2. Tables with company_id=NULL (legacy seeded data) are NOT accessible to any company
3. New registrations seed company-specific departments during onboarding
*/

-- ============================================================
-- SUBSCRIPTION PLANS
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  price_bhd numeric(10,3) DEFAULT 0,
  max_employees integer,
  billing_cycle text DEFAULT 'monthly',
  modules text[] NOT NULL DEFAULT '{}',
  description text,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_popular boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  address text,
  phone text,
  email text,
  website text,
  country text DEFAULT 'Bahrain',
  industry text,
  cr_number text,
  subscription_plan_id uuid REFERENCES subscription_plans(id),
  subscription_status text NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'inactive', 'trial', 'cancelled', 'expired')),
  subscription_start date DEFAULT CURRENT_DATE,
  subscription_end date,
  trial_ends_at timestamptz,
  admin_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_admin ON companies(admin_user_id);

-- ============================================================
-- COMPANY USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'manager', 'hr', 'viewer')),
  is_active boolean DEFAULT true,
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_users_user ON company_users(user_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company ON company_users(company_id);

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- ============================================================
-- ADD company_id TO OPERATIONAL TABLES
-- ============================================================

ALTER TABLE departments        ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE positions          ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE employees          ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE leave_requests     ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE leave_balances     ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE payroll_runs       ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE payroll_line_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE system_notifications ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- Fix payroll_runs unique constraint to be company-scoped
ALTER TABLE payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_month_year_key;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_company_month_year UNIQUE(company_id, month, year);

CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_positions_company ON positions(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);

-- ============================================================
-- RLS FOR NEW TABLES
-- ============================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;

-- subscription_plans: public read (needed for registration)
DROP POLICY IF EXISTS "plans_read_all" ON subscription_plans;
CREATE POLICY "plans_read_all" ON subscription_plans FOR SELECT TO anon, authenticated USING (true);

-- companies: members can read/update their own company; anyone can insert (registration)
DROP POLICY IF EXISTS "companies_select" ON companies;
CREATE POLICY "companies_select" ON companies FOR SELECT TO authenticated
  USING (id = get_current_company_id());

DROP POLICY IF EXISTS "companies_insert" ON companies;
CREATE POLICY "companies_insert" ON companies FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "companies_update" ON companies;
CREATE POLICY "companies_update" ON companies FOR UPDATE TO authenticated
  USING (id = get_current_company_id()) WITH CHECK (id = get_current_company_id());

-- company_users: insert allowed for authenticated (registration + admin invite)
DROP POLICY IF EXISTS "cu_select" ON company_users;
CREATE POLICY "cu_select" ON company_users FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR company_id = get_current_company_id());

DROP POLICY IF EXISTS "cu_insert" ON company_users;
CREATE POLICY "cu_insert" ON company_users FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cu_update" ON company_users;
CREATE POLICY "cu_update" ON company_users FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

-- ============================================================
-- UPDATE RLS FOR OPERATIONAL TABLES (company-scoped)
-- ============================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'departments','positions','employees','leave_requests','leave_balances',
    'employee_documents','payroll_runs','payroll_line_items','system_notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "open_select" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_select" ON %I FOR SELECT TO authenticated USING (company_id = get_current_company_id())', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "open_insert" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_insert" ON %I FOR INSERT TO authenticated WITH CHECK (company_id = get_current_company_id())', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "open_update" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_update" ON %I FOR UPDATE TO authenticated USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id())', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "open_delete" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_delete" ON %I FOR DELETE TO authenticated USING (company_id = get_current_company_id())', tbl);
  END LOOP;
END $$;
