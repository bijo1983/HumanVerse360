-- ============================================================
-- 38: Payslip templates + report field mappings (Phase 7)
-- ============================================================

CREATE TABLE IF NOT EXISTS payslip_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'Default',
  -- {"identity":[{"fieldKey":"national_id","label":"CPR Number","mask":"none|last4"}...],
  --  "statutoryDeductionLabel":"GOSI (Employee)",
  --  "employerBlock":{"visible":true},"ytdBlock":{"visible":false}}
  layout        jsonb NOT NULL DEFAULT '{}',
  is_default    boolean NOT NULL DEFAULT true,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, name)
);

ALTER TABLE payslip_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY pt_read ON payslip_templates FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
CREATE POLICY pt_company_write ON payslip_templates FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
CREATE POLICY pt_platform_write ON payslip_templates FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO payslip_templates (country_code, layout) VALUES
  ('BH', '{"identity":[{"fieldKey":"national_id","label":"CPR Number","mask":"none"},{"fieldKey":"gosi_number","label":"GOSI No."}],"statutoryDeductionLabel":"GOSI (Employee)","employerBlock":{"visible":true},"ytdBlock":{"visible":false}}'),
  ('AE', '{"identity":[{"fieldKey":"national_id","label":"Emirates ID","mask":"last4"},{"fieldKey":"wps_person_id","label":"WPS ID"}],"statutoryDeductionLabel":"GPSSA (Employee)","employerBlock":{"visible":false},"ytdBlock":{"visible":false}}'),
  ('SA', '{"identity":[{"fieldKey":"national_id","label":"National ID / Iqama","mask":"last4"},{"fieldKey":"gosi_id_sa","label":"GOSI No."}],"statutoryDeductionLabel":"GOSI (Employee)","employerBlock":{"visible":false},"ytdBlock":{"visible":false}}'),
  ('OM', '{"identity":[{"fieldKey":"national_id","label":"Civil ID","mask":"last4"},{"fieldKey":"pasi_number","label":"PASI No."}],"statutoryDeductionLabel":"PASI (Employee)","employerBlock":{"visible":false},"ytdBlock":{"visible":false}}'),
  ('QA', '{"identity":[{"fieldKey":"national_id","label":"QID","mask":"last4"}],"statutoryDeductionLabel":"Pension (Employee)","employerBlock":{"visible":false},"ytdBlock":{"visible":false}}'),
  ('KW', '{"identity":[{"fieldKey":"national_id","label":"Civil ID","mask":"last4"},{"fieldKey":"pifss_number","label":"PIFSS No."}],"statutoryDeductionLabel":"PIFSS (Employee)","employerBlock":{"visible":false},"ytdBlock":{"visible":false}}'),
  ('IN', '{"identity":[{"fieldKey":"national_id","label":"Aadhaar","mask":"last4"},{"fieldKey":"pan_number","label":"PAN","mask":"last4"},{"fieldKey":"uan","label":"UAN"},{"fieldKey":"pf_number","label":"PF No."}],"statutoryDeductionLabel":"Statutory (PF/ESI/PT/TDS)","employerBlock":{"visible":false},"ytdBlock":{"visible":true,"label":"FY To Date"}}'),
  ('GB', '{"identity":[{"fieldKey":"national_id","label":"NI Number","mask":"last4"},{"fieldKey":"tax_code","label":"Tax Code"},{"fieldKey":"ni_category","label":"NI Letter"}],"statutoryDeductionLabel":"PAYE / NI / Pension","employerBlock":{"visible":false},"ytdBlock":{"visible":true,"label":"Year to Date"}}'),
  ('US', '{"identity":[{"fieldKey":"national_id","label":"SSN","mask":"last4"},{"fieldKey":"w4_filing_status","label":"Filing Status"}],"statutoryDeductionLabel":"Taxes & FICA","employerBlock":{"visible":false},"ytdBlock":{"visible":true,"label":"Year to Date"}}')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS report_field_mappings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) REFERENCES countries(code),      -- NULL = global default
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  report_code   text NOT NULL,        -- 'employee_master','payroll_register'
  field_key     text NOT NULL,        -- logical field
  column_label  text NOT NULL,        -- header shown in the export
  source        text NOT NULL,        -- 'employees.cpr_number' | 'dynamic:pan_number' | 'component:GOSI_EE'
  display_order integer NOT NULL DEFAULT 0,
  format        text,                 -- 'currency','date','masked'
  is_visible    boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (report_code, field_key, country_code, company_id)
);

ALTER TABLE report_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY rfm_read ON report_field_mappings FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
CREATE POLICY rfm_company_write ON report_field_mappings FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
CREATE POLICY rfm_platform_write ON report_field_mappings FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Employee master: national ID column label per country (stored in employees.cpr_number)
INSERT INTO report_field_mappings (country_code, report_code, field_key, column_label, source, display_order, format) VALUES
  ('BH','employee_master','national_id','CPR Number','employees.cpr_number',10,'masked'),
  ('AE','employee_master','national_id','Emirates ID','employees.cpr_number',10,'masked'),
  ('SA','employee_master','national_id','National ID / Iqama','employees.cpr_number',10,'masked'),
  ('OM','employee_master','national_id','Civil ID','employees.cpr_number',10,'masked'),
  ('QA','employee_master','national_id','QID','employees.cpr_number',10,'masked'),
  ('KW','employee_master','national_id','Civil ID','employees.cpr_number',10,'masked'),
  ('IN','employee_master','national_id','Aadhaar Number','employees.cpr_number',10,'masked'),
  ('GB','employee_master','national_id','NI Number','employees.cpr_number',10,'masked'),
  ('US','employee_master','national_id','SSN','employees.cpr_number',10,'masked'),
-- Payroll register: statutory column labels per country
  ('BH','payroll_register','statutory_ee','GOSI (Employee)','component:statutory_ee',20,'currency'),
  ('BH','payroll_register','statutory_er','GOSI (Employer)','component:statutory_er',21,'currency'),
  ('AE','payroll_register','statutory_ee','GPSSA (Employee)','component:statutory_ee',20,'currency'),
  ('AE','payroll_register','statutory_er','GPSSA (Employer)','component:statutory_er',21,'currency'),
  ('SA','payroll_register','statutory_ee','GOSI (Employee)','component:statutory_ee',20,'currency'),
  ('SA','payroll_register','statutory_er','GOSI (Employer)','component:statutory_er',21,'currency'),
  ('OM','payroll_register','statutory_ee','PASI (Employee)','component:statutory_ee',20,'currency'),
  ('OM','payroll_register','statutory_er','PASI (Employer)','component:statutory_er',21,'currency'),
  ('QA','payroll_register','statutory_ee','Pension (Employee)','component:statutory_ee',20,'currency'),
  ('QA','payroll_register','statutory_er','Pension (Employer)','component:statutory_er',21,'currency'),
  ('KW','payroll_register','statutory_ee','PIFSS (Employee)','component:statutory_ee',20,'currency'),
  ('KW','payroll_register','statutory_er','PIFSS (Employer)','component:statutory_er',21,'currency'),
  ('IN','payroll_register','statutory_ee','Statutory (PF/ESI/PT/TDS)','component:statutory_ee',20,'currency'),
  ('IN','payroll_register','statutory_er','Employer Contributions','component:statutory_er',21,'currency'),
  ('GB','payroll_register','statutory_ee','PAYE / NI / Pension','component:statutory_ee',20,'currency'),
  ('GB','payroll_register','statutory_er','Employer NI / Pension','component:statutory_er',21,'currency'),
  ('US','payroll_register','statutory_ee','Taxes & FICA (Employee)','component:statutory_ee',20,'currency'),
  ('US','payroll_register','statutory_er','Employer Taxes (FICA/FUTA/SUTA)','component:statutory_er',21,'currency')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
