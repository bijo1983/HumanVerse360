
-- Fix departments unique constraint to be company-scoped (not global)
-- First drop the global unique on code
ALTER TABLE departments DROP CONSTRAINT IF EXISTS departments_code_key;

-- Add a company-scoped unique index instead
CREATE UNIQUE INDEX IF NOT EXISTS departments_company_code_unique
  ON departments (company_id, code);

-- Now seed the company for the existing user
DO $$
DECLARE
  v_user_id uuid := 'c9ca01a5-01c9-46c0-b864-0bca5af43579';
  v_plan_id uuid := 'a7909f8f-e176-4c93-aa90-88f90a9f7857';
  v_company_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE admin_user_id = v_user_id) THEN
    INSERT INTO companies (
      name, email, admin_user_id, subscription_plan_id, subscription_status
    ) VALUES (
      'Innovegi IT', 'bijo.mammen@innovegicit.com', v_user_id, v_plan_id, 'active'
    ) RETURNING id INTO v_company_id;

    INSERT INTO company_users (company_id, user_id, full_name, email, role, is_active)
    VALUES (v_company_id, v_user_id, 'Bijo Mammen', 'bijo.mammen@innovegicit.com', 'admin', true);

    INSERT INTO departments (name, code, company_id) VALUES
      ('Human Resources', 'HR', v_company_id),
      ('Finance', 'FIN', v_company_id),
      ('Operations', 'OPS', v_company_id),
      ('Management', 'MGT', v_company_id);
  END IF;
END $$;
