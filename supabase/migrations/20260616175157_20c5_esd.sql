
-- employee_salary_details: scope via employee → company.
-- Must qualify employee_salary_details.employee_id explicitly because employees
-- also has a text column called employee_id, which would shadow the uuid FK
-- column inside the subquery and cause a uuid = text type mismatch.
DROP POLICY IF EXISTS open_insert ON employee_salary_details;
DROP POLICY IF EXISTS open_update ON employee_salary_details;
DROP POLICY IF EXISTS open_delete ON employee_salary_details;

CREATE POLICY esd_insert ON employee_salary_details FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_salary_details.employee_id
      AND e.company_id = get_current_company_id()));

CREATE POLICY esd_update ON employee_salary_details FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_salary_details.employee_id
      AND e.company_id = get_current_company_id()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_salary_details.employee_id
      AND e.company_id = get_current_company_id()));

CREATE POLICY esd_delete ON employee_salary_details FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = employee_salary_details.employee_id
      AND e.company_id = get_current_company_id()));
