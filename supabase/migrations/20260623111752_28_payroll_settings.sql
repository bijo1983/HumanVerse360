CREATE TABLE IF NOT EXISTS payroll_settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  uuid UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bahraini_employee_gosi_pct  numeric(5,2) NOT NULL DEFAULT 8,
  bahraini_employer_gosi_pct  numeric(5,2) NOT NULL DEFAULT 13,
  expat_employee_gosi_pct     numeric(5,2) NOT NULL DEFAULT 1,
  expat_employer_gosi_pct     numeric(5,2) NOT NULL DEFAULT 3,
  working_days_per_month      integer      NOT NULL DEFAULT 26,
  ot_rate_normal              numeric(4,2) NOT NULL DEFAULT 1.25,
  ot_rate_holiday             numeric(4,2) NOT NULL DEFAULT 1.50,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE payroll_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ps_select" ON payroll_settings FOR SELECT TO authenticated
  USING (company_id = get_current_company_id());

CREATE POLICY "ps_insert" ON payroll_settings FOR INSERT TO authenticated
  WITH CHECK (company_id = get_current_company_id());

CREATE POLICY "ps_update" ON payroll_settings FOR UPDATE TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());

CREATE POLICY "ps_delete" ON payroll_settings FOR DELETE TO authenticated
  USING (company_id = get_current_company_id());
