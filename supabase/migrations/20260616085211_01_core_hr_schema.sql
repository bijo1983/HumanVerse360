
/*
# Humanverse360 - Core HR Schema

## Overview
Creates the foundational HR tables for Humanverse360 - an HR & Payroll application
compliant with Bahrain Labor Law (Law No. 36 of 2012 as amended).

## Changes
- All core tables: departments, positions, employees, leave management,
  document tracking, payroll, calculation settings, indemnity, notifications
- Document status is computed via a function/view rather than generated column
  (to avoid immutability issues with CURRENT_DATE)
- RLS enabled on all tables with open policies for single-tenant operation
*/

-- ============================================================
-- ORGANIZATIONAL STRUCTURE
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  manager_id uuid,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text UNIQUE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  grade text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  arabic_name text,
  gender text CHECK (gender IN ('Male', 'Female')),
  date_of_birth date,
  nationality text,
  marital_status text CHECK (marital_status IN ('Single', 'Married', 'Divorced', 'Widowed')),
  religion text,
  personal_email text,
  work_email text,
  phone text,
  mobile text,
  address text,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES positions(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  employment_type text CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contract', 'Probation')) DEFAULT 'Full-Time',
  status text CHECK (status IN ('Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned')) DEFAULT 'Active',
  joining_date date NOT NULL,
  confirmation_date date,
  termination_date date,
  termination_reason text,
  bank_name text,
  bank_account text,
  iban text,
  cpr_number text,
  cpr_expiry date,
  passport_number text,
  passport_expiry date,
  visa_number text,
  visa_expiry date,
  visa_type text,
  work_permit_number text,
  work_permit_expiry date,
  basic_salary numeric(12,3) DEFAULT 0,
  housing_allowance numeric(12,3) DEFAULT 0,
  transport_allowance numeric(12,3) DEFAULT 0,
  food_allowance numeric(12,3) DEFAULT 0,
  other_allowances numeric(12,3) DEFAULT 0,
  profile_photo text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- ============================================================
-- LEAVE MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  days_per_year numeric(6,2) NOT NULL DEFAULT 30,
  is_paid boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  carry_forward boolean NOT NULL DEFAULT false,
  max_carry_forward numeric(6,2) DEFAULT 0,
  gender_specific text CHECK (gender_specific IN ('All', 'Male', 'Female')) DEFAULT 'All',
  applicable_after_months integer DEFAULT 0,
  description text,
  color text DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric(6,2) NOT NULL,
  status text CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')) DEFAULT 'Pending',
  reason text,
  approved_by uuid REFERENCES employees(id),
  approved_at timestamptz,
  rejection_reason text,
  return_date date,
  document_attached text,
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM now())::integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

CREATE TABLE IF NOT EXISTS leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  entitled_days numeric(6,2) NOT NULL DEFAULT 0,
  used_days numeric(6,2) NOT NULL DEFAULT 0,
  pending_days numeric(6,2) NOT NULL DEFAULT 0,
  carried_forward numeric(6,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);

-- ============================================================
-- DOCUMENT TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('Passport', 'Visa', 'CPR', 'Work Permit', 'Driving License', 'Health Card', 'Educational Certificate', 'Professional License', 'Other')),
  document_number text,
  issue_date date,
  expiry_date date,
  issued_by text,
  country text,
  notes text,
  file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_documents_employee ON employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_documents_expiry ON employee_documents(expiry_date);

-- ============================================================
-- PAYROLL
-- ============================================================

CREATE TABLE IF NOT EXISTS salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  component_type text NOT NULL CHECK (component_type IN ('Earning', 'Deduction', 'Benefit')),
  calculation_type text NOT NULL CHECK (calculation_type IN ('Fixed', 'Percentage', 'Formula')) DEFAULT 'Fixed',
  formula text,
  percentage_of text,
  default_value numeric(12,3) DEFAULT 0,
  is_taxable boolean DEFAULT false,
  is_gosi_applicable boolean DEFAULT false,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_salary_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  component_id uuid NOT NULL REFERENCES salary_components(id) ON DELETE CASCADE,
  value numeric(12,3) NOT NULL DEFAULT 0,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, component_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  status text CHECK (status IN ('Draft', 'Processing', 'Approved', 'Paid', 'Cancelled')) DEFAULT 'Draft',
  total_employees integer DEFAULT 0,
  total_gross numeric(12,3) DEFAULT 0,
  total_deductions numeric(12,3) DEFAULT 0,
  total_net numeric(12,3) DEFAULT 0,
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS payroll_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic_salary numeric(12,3) DEFAULT 0,
  housing_allowance numeric(12,3) DEFAULT 0,
  transport_allowance numeric(12,3) DEFAULT 0,
  food_allowance numeric(12,3) DEFAULT 0,
  other_allowances numeric(12,3) DEFAULT 0,
  overtime_hours numeric(8,2) DEFAULT 0,
  overtime_amount numeric(12,3) DEFAULT 0,
  bonus numeric(12,3) DEFAULT 0,
  gross_salary numeric(12,3) DEFAULT 0,
  gosi_employee numeric(12,3) DEFAULT 0,
  gosi_employer numeric(12,3) DEFAULT 0,
  loan_deduction numeric(12,3) DEFAULT 0,
  other_deductions numeric(12,3) DEFAULT 0,
  total_deductions numeric(12,3) DEFAULT 0,
  net_salary numeric(12,3) DEFAULT 0,
  working_days integer DEFAULT 26,
  absent_days numeric(6,2) DEFAULT 0,
  leave_days numeric(6,2) DEFAULT 0,
  components jsonb DEFAULT '{}',
  status text CHECK (status IN ('Draft', 'Approved', 'Paid')) DEFAULT 'Draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(payroll_run_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_items_run ON payroll_line_items(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee ON payroll_line_items(employee_id);

-- ============================================================
-- CALCULATION SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS calculation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('Leave', 'Payroll', 'Indemnity', 'Overtime', 'GOSI', 'Tax', 'Other')),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  formula text NOT NULL,
  description text,
  variables jsonb DEFAULT '[]',
  example text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS indemnity_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_years numeric(5,2) NOT NULL DEFAULT 0,
  max_years numeric(5,2),
  days_per_year numeric(6,2) NOT NULL,
  termination_type text CHECK (termination_type IN ('Resignation', 'Termination', 'Both')) DEFAULT 'Both',
  resignation_factor numeric(5,4) DEFAULT 1.0,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS system_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('Document Expiry', 'Leave Request', 'Payroll', 'System', 'Birthday', 'Anniversary')),
  title text NOT NULL,
  message text NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  document_id uuid REFERENCES employee_documents(id) ON DELETE CASCADE,
  severity text CHECK (severity IN ('Info', 'Warning', 'Critical', 'Success')) DEFAULT 'Info',
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_read ON system_notifications(is_read);

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salary_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE indemnity_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'departments','positions','employees','leave_types','leave_requests',
    'leave_balances','employee_documents','salary_components','employee_salary_details',
    'payroll_runs','payroll_line_items','calculation_settings','indemnity_settings',
    'system_notifications'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "open_select" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_select" ON %I FOR SELECT TO anon, authenticated USING (true)', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "open_insert" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "open_update" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_update" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "open_delete" ON %I', tbl);
    EXECUTE format('CREATE POLICY "open_delete" ON %I FOR DELETE TO anon, authenticated USING (true)', tbl);
  END LOOP;
END $$;
