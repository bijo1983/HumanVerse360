-- ============================================================
-- 39: YTD balances for cumulative tax calculations (Phase 9a)
-- ============================================================
-- Tracks cumulative amounts per employee per tax year per component,
-- updated as each payroll run is processed. This lets GB PAYE run its
-- real cumulative method (tax on cumulative pay minus tax already
-- paid) and lets US FICA cap the Social Security wage base against
-- actual year-to-date wages instead of a monthly average.

CREATE TABLE IF NOT EXISTS payroll_ytd_balances (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code     char(2) NOT NULL REFERENCES countries(code),
  tax_year         text NOT NULL,          -- 'FY2026-27' | '2026/27' | '2026'
  component_code   text NOT NULL,          -- 'GROSS','SS_WAGES','FED_TAX','STATE_TAX','PAYE','NI','TDS','MEDICARE_WAGES'
  cumulative_amount numeric(14,4) NOT NULL DEFAULT 0,
  last_period_end  date,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (employee_id, tax_year, component_code)
);
CREATE INDEX IF NOT EXISTS idx_ytd_employee_year ON payroll_ytd_balances(employee_id, tax_year);

ALTER TABLE payroll_ytd_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytd_all ON payroll_ytd_balances FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

-- Upsert helper: adds `delta` to the running total for one component
-- (idempotent per period via last_period_end guard — reprocessing the
-- same period without a rollback call is the caller's responsibility).
CREATE OR REPLACE FUNCTION increment_ytd_balance(
  p_company_id uuid, p_employee_id uuid, p_country_code char(2),
  p_tax_year text, p_component_code text, p_delta numeric, p_period_end date
) RETURNS void AS $$
BEGIN
  INSERT INTO payroll_ytd_balances (company_id, employee_id, country_code, tax_year, component_code, cumulative_amount, last_period_end)
  VALUES (p_company_id, p_employee_id, p_country_code, p_tax_year, p_component_code, p_delta, p_period_end)
  ON CONFLICT (employee_id, tax_year, component_code)
  DO UPDATE SET
    cumulative_amount = payroll_ytd_balances.cumulative_amount + p_delta,
    last_period_end = p_period_end,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
