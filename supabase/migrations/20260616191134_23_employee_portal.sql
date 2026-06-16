-- ── Portal slug for companies ──────────────────────────────────────────────
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS portal_slug text UNIQUE;

-- Auto-generate slug from company name for existing companies
UPDATE companies
SET portal_slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9 ]', '', 'g'),
    ' +', '-', 'g'
  )
)
WHERE portal_slug IS NULL;

-- ── Portal user link on employees ───────────────────────────────────────────
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_portal_user_id
  ON employees(portal_user_id) WHERE portal_user_id IS NOT NULL;

-- ── Helper: get current portal employee's row ID ────────────────────────────
CREATE OR REPLACE FUNCTION get_portal_employee_id()
RETURNS uuid AS $$
  SELECT id FROM public.employees
  WHERE portal_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_portal_employee_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_portal_employee_id() TO authenticated;

-- ── Helper: get portal company info (bypasses RLS, for public portal page) ──
CREATE OR REPLACE FUNCTION get_portal_company_info(p_slug text)
RETURNS jsonb AS $$
DECLARE v jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id',       c.id,
    'name',     c.name,
    'logo_url', c.logo_url,
    'country',  c.country
  ) INTO v
  FROM companies c
  WHERE c.portal_slug = p_slug
    AND c.subscription_status IN ('active', 'trial');
  RETURN v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_portal_company_info(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_portal_company_info(text) TO anon, authenticated;

-- ── Helper: validate employee for registration ───────────────────────────────
CREATE OR REPLACE FUNCTION validate_portal_employee(
  p_employee_code text,
  p_work_email    text,
  p_slug          text
) RETURNS jsonb AS $$
DECLARE
  v_emp  employees%ROWTYPE;
  v_comp companies%ROWTYPE;
BEGIN
  SELECT * INTO v_comp FROM companies WHERE portal_slug = p_slug
    AND subscription_status IN ('active', 'trial');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Company portal not found or inactive');
  END IF;

  SELECT * INTO v_emp
  FROM employees
  WHERE employee_id  = p_employee_code
    AND lower(work_email) = lower(p_work_email)
    AND company_id   = v_comp.id
    AND status       = 'Active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Employee not found. Check your Employee ID and work email.');
  END IF;

  IF v_emp.portal_user_id IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'This employee is already registered. Please log in instead.');
  END IF;

  RETURN jsonb_build_object(
    'valid',      true,
    'emp_db_id',  v_emp.id::text,
    'email',      v_emp.work_email,
    'first_name', v_emp.first_name,
    'last_name',  v_emp.last_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION validate_portal_employee(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION validate_portal_employee(text, text, text) TO anon, authenticated;

-- ── Helper: lookup employee work_email by employee code + slug (for login) ──
CREATE OR REPLACE FUNCTION get_portal_employee_email(
  p_employee_code text,
  p_slug          text
) RETURNS text AS $$
DECLARE v_email text;
BEGIN
  SELECT e.work_email INTO v_email
  FROM employees e
  JOIN companies c ON c.id = e.company_id
  WHERE e.employee_id  = p_employee_code
    AND c.portal_slug  = p_slug
    AND e.status       = 'Active'
    AND c.subscription_status IN ('active', 'trial');
  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE
   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_portal_employee_email(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_portal_employee_email(text, text) TO anon, authenticated;

-- ── Helper: link auth user to employee after sign-up ────────────────────────
CREATE OR REPLACE FUNCTION link_portal_employee(
  p_employee_code text,
  p_work_email    text,
  p_slug          text
) RETURNS void AS $$
BEGIN
  UPDATE employees e
  SET portal_user_id = auth.uid()
  FROM companies c
  WHERE e.employee_id         = p_employee_code
    AND lower(e.work_email)   = lower(p_work_email)
    AND e.company_id          = c.id
    AND c.portal_slug         = p_slug
    AND e.status              = 'Active'
    AND e.portal_user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not link portal account. Employee not found or already registered.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION link_portal_employee(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION link_portal_employee(text, text, text) TO authenticated;

-- ── Portal RLS policies ──────────────────────────────────────────────────────

-- employees: portal user reads/updates ONLY their own record
CREATE POLICY emp_portal_select ON employees FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());

CREATE POLICY emp_portal_update ON employees FOR UPDATE TO authenticated
  USING (portal_user_id = auth.uid())
  WITH CHECK (portal_user_id = auth.uid());

-- leave_balances: portal user reads their own balances
CREATE POLICY lb_portal_select ON leave_balances FOR SELECT TO authenticated
  USING (employee_id = get_portal_employee_id());

-- leave_requests: portal user reads + inserts their own requests
CREATE POLICY lr_portal_select ON leave_requests FOR SELECT TO authenticated
  USING (employee_id = get_portal_employee_id());

CREATE POLICY lr_portal_insert ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = get_portal_employee_id()
    AND company_id = (SELECT company_id FROM employees WHERE id = get_portal_employee_id())
  );

-- Portal employees may cancel (update status) their own pending requests
CREATE POLICY lr_portal_update ON leave_requests FOR UPDATE TO authenticated
  USING  (employee_id = get_portal_employee_id() AND status = 'Pending')
  WITH CHECK (employee_id = get_portal_employee_id());

-- employee_documents: portal user reads their own
CREATE POLICY ed_portal_select ON employee_documents FOR SELECT TO authenticated
  USING (employee_id = get_portal_employee_id());

-- payroll_line_items: portal user reads their own payslips
CREATE POLICY pli_portal_select ON payroll_line_items FOR SELECT TO authenticated
  USING (employee_id = get_portal_employee_id());

-- payroll_runs: portal user reads runs that have their items (needed for payslip header)
CREATE POLICY pr_portal_select ON payroll_runs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM payroll_line_items
      WHERE payroll_run_id = payroll_runs.id
        AND employee_id = get_portal_employee_id()
    )
  );
