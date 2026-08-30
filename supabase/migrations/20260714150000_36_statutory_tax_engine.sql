-- ============================================================
-- 36: Statutory modules, statutory rules, tax rules & slabs (Phase 5)
--     All rates are effective-dated data — never code literals.
--     Seeded values are ILLUSTRATIVE defaults; refresh via annual
--     legislation packs and verify against official sources.
-- ============================================================

CREATE TABLE IF NOT EXISTS statutory_modules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  module_code    text NOT NULL,
  module_name    text NOT NULL,
  category       text NOT NULL CHECK (category IN
                   ('social_insurance','tax','labour','identity','wage_protection','pension','benefits')),
  is_enabled_by_default boolean NOT NULL DEFAULT true,
  description    text,
  UNIQUE (country_code, module_code)
);

ALTER TABLE statutory_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sm_read ON statutory_modules;
CREATE POLICY sm_read ON statutory_modules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS sm_admin_write ON statutory_modules;
CREATE POLICY sm_admin_write ON statutory_modules FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS company_statutory_modules (
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id   uuid NOT NULL REFERENCES statutory_modules(id) ON DELETE CASCADE,
  is_enabled  boolean NOT NULL DEFAULT true,
  settings    jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (company_id, module_id)
);
ALTER TABLE company_statutory_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS csm_all ON company_statutory_modules;
CREATE POLICY csm_all ON company_statutory_modules FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

CREATE TABLE IF NOT EXISTS country_statutory_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  module_code    text NOT NULL,
  rule_key       text NOT NULL,
  rule_value     jsonb NOT NULL,   -- number | object | slab array
  applicable_to  text,             -- 'citizen' | 'expat' | NULL = all
  effective_from date NOT NULL,
  effective_to   date,
  source_ref     text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (country_code, module_code, rule_key, applicable_to, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_csr_lookup ON country_statutory_rules(country_code, rule_key, effective_from);

ALTER TABLE country_statutory_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS csr_read ON country_statutory_rules;
CREATE POLICY csr_read ON country_statutory_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS csr_admin_write ON country_statutory_rules;
CREATE POLICY csr_admin_write ON country_statutory_rules FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS tax_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code       char(2) NOT NULL REFERENCES countries(code),
  tax_code           text NOT NULL,      -- 'IN_TDS','GB_PAYE','US_FED','US_STATE'
  tax_name           text NOT NULL,
  tax_year           text NOT NULL,      -- 'FY2026-27' | '2026/27' | '2026'
  regime             text,               -- IN: 'new'/'old'; US: filing status
  jurisdiction       text,               -- US state code / IN PT state
  calculation_method text NOT NULL DEFAULT 'slab'
                       CHECK (calculation_method IN ('slab','flat_rate','formula','external')),
  flat_rate          numeric(8,5),
  formula            text,
  annualization      text NOT NULL DEFAULT 'annualize_ytd'
                       CHECK (annualization IN ('annualize_ytd','period_table','cumulative')),
  extras             jsonb NOT NULL DEFAULT '{}',  -- standard_deduction, cess_pct, rebate limits, allowance…
  effective_from     date NOT NULL,
  effective_to       date,
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (country_code, tax_code, tax_year, regime, jurisdiction)
);

ALTER TABLE tax_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tr_read ON tax_rules;
CREATE POLICY tr_read ON tax_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tr_admin_write ON tax_rules;
CREATE POLICY tr_admin_write ON tax_rules FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

CREATE TABLE IF NOT EXISTS tax_slabs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_rule_id  uuid NOT NULL REFERENCES tax_rules(id) ON DELETE CASCADE,
  slab_order   smallint NOT NULL,
  income_from  numeric(14,2) NOT NULL,
  income_to    numeric(14,2),
  rate_pct     numeric(8,5) NOT NULL,
  UNIQUE (tax_rule_id, slab_order)
);
ALTER TABLE tax_slabs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ts_read ON tax_slabs;
CREATE POLICY ts_read ON tax_slabs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ts_admin_write ON tax_slabs;
CREATE POLICY ts_admin_write ON tax_slabs FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- ------------------------------------------------------------
-- Statutory module seeds
-- ------------------------------------------------------------
INSERT INTO statutory_modules (country_code, module_code, module_name, category) VALUES
  ('BH','GOSI','Social Insurance (SIO)','social_insurance'),
  ('BH','LMRA','Labour Market Regulatory Authority','labour'),
  ('BH','WPS','Wage Protection System','wage_protection'),
  ('AE','WPS','Wage Protection System (SIF)','wage_protection'),
  ('AE','MOHRE','Ministry of Human Resources & Emiratisation','labour'),
  ('AE','GPSSA','General Pension & Social Security Authority','social_insurance'),
  ('AE','MED_INS_MANDATE','Medical Insurance Mandate','benefits'),
  ('SA','GOSI','General Organization for Social Insurance','social_insurance'),
  ('SA','QIWA','Qiwa Platform','labour'),
  ('SA','MUDAD','Mudad Payroll Platform','wage_protection'),
  ('OM','PASI','Social Protection Fund (PASI)','social_insurance'),
  ('QA','PENSION','GRSIA Pension (Qatari nationals)','social_insurance'),
  ('QA','WPS','Wage Protection System','wage_protection'),
  ('KW','PIFSS','Public Institution for Social Security','social_insurance'),
  ('IN','PF','Employees'' Provident Fund (EPFO)','social_insurance'),
  ('IN','ESI','Employees'' State Insurance','social_insurance'),
  ('IN','PT','Professional Tax (State)','tax'),
  ('IN','TDS','Income Tax TDS (Sec 192)','tax'),
  ('IN','LWF','Labour Welfare Fund','labour'),
  ('GB','PAYE','PAYE Income Tax (HMRC)','tax'),
  ('GB','NI','National Insurance','social_insurance'),
  ('GB','PENSION','Pension Auto-Enrolment','pension'),
  ('GB','STUDENT_LOAN','Student Loan Deductions','tax'),
  ('GB','RTI','Real Time Information (FPS/EPS)','tax'),
  ('US','FED_WH','Federal Withholding (W-4)','tax'),
  ('US','STATE_WH','State Withholding','tax'),
  ('US','FICA','Social Security & Medicare','social_insurance'),
  ('US','FUTA','Federal Unemployment Tax','tax'),
  ('US','SUTA','State Unemployment Tax','tax'),
  ('US','K401','401(k) Plan','benefits'),
  ('US','I9','I-9 Employment Eligibility','identity')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Statutory rate rules (illustrative values — legislation packs update these)
-- ------------------------------------------------------------
INSERT INTO country_statutory_rules
  (country_code, module_code, rule_key, rule_value, applicable_to, effective_from, source_ref)
VALUES
-- Bahrain GOSI (SIO); ceiling BHD 4,000/month
  ('BH','GOSI','employee_pct','0.08','citizen','2024-01-01','SIO — pension 7% + unemployment 1%'),
  ('BH','GOSI','employer_pct','0.13','citizen','2024-01-01','SIO — pension 12% + unemployment 1% (illustrative)'),
  ('BH','GOSI','employee_pct','0.01','expat','2024-01-01','SIO — unemployment 1%'),
  ('BH','GOSI','employer_pct','0.03','expat','2024-01-01','SIO — work injury 3%'),
  ('BH','GOSI','wage_ceiling','4000',NULL,'2024-01-01','SIO monthly contributory wage ceiling'),
-- Saudi GOSI; ceiling SAR 45,000/month
  ('SA','GOSI','employee_pct','0.0975','citizen','2024-07-01','GOSI — pension 9% + SANED 0.75% (illustrative)'),
  ('SA','GOSI','employer_pct','0.1175','citizen','2024-07-01','GOSI — pension 9% + SANED 0.75% + OH 2% (illustrative)'),
  ('SA','GOSI','employee_pct','0',NULL,'2024-07-01','Expat employees: no employee share'),
  ('SA','GOSI','employer_pct','0.02','expat','2024-07-01','Occupational hazards 2%'),
  ('SA','GOSI','wage_ceiling','45000',NULL,'2024-07-01','GOSI contributory wage ceiling'),
-- UAE GPSSA (nationals); ceiling AED 50,000/month (private sector)
  ('AE','GPSSA','employee_pct','0.05','citizen','2024-01-01','GPSSA employee share (illustrative)'),
  ('AE','GPSSA','employer_pct','0.125','citizen','2024-01-01','GPSSA private employer share (illustrative)'),
  ('AE','GPSSA','wage_ceiling','50000',NULL,'2024-01-01','GPSSA contributory salary ceiling'),
-- Oman PASI / Social Protection Fund (nationals)
  ('OM','PASI','employee_pct','0.07','citizen','2024-01-01','Social Protection Fund (illustrative)'),
  ('OM','PASI','employer_pct','0.11','citizen','2024-01-01','Social Protection Fund incl. work injury (illustrative)'),
  ('OM','PASI','wage_ceiling','3000',NULL,'2024-01-01','Illustrative ceiling'),
-- Qatar GRSIA pension (Qatari nationals)
  ('QA','PENSION','employee_pct','0.07','citizen','2024-01-01','GRSIA (illustrative)'),
  ('QA','PENSION','employer_pct','0.14','citizen','2024-01-01','GRSIA (illustrative)'),
  ('QA','PENSION','wage_ceiling','100000',NULL,'2024-01-01','Illustrative ceiling'),
-- Kuwait PIFSS (Kuwaiti nationals); ceiling KWD 2,750/month
  ('KW','PIFSS','employee_pct','0.115','citizen','2024-01-01','PIFSS employee shares combined (illustrative)'),
  ('KW','PIFSS','employer_pct','0.115','citizen','2024-01-01','PIFSS employer share (illustrative)'),
  ('KW','PIFSS','wage_ceiling','2750',NULL,'2024-01-01','PIFSS salary ceiling'),
-- India PF / ESI / PT
  ('IN','PF','employee_pct','0.12',NULL,'2024-04-01','EPF Act'),
  ('IN','PF','employer_pct','0.12',NULL,'2024-04-01','EPF Act (3.67% EPF + 8.33% EPS)'),
  ('IN','PF','wage_cap','15000',NULL,'2024-04-01','Statutory PF wage ceiling ₹15,000/month'),
  ('IN','ESI','employee_pct','0.0075',NULL,'2024-04-01','ESI Act'),
  ('IN','ESI','employer_pct','0.0325',NULL,'2024-04-01','ESI Act'),
  ('IN','ESI','wage_ceiling','21000',NULL,'2024-04-01','ESI eligibility ceiling ₹21,000/month'),
  ('IN','PT','slabs_Karnataka','[{"upTo":24999,"amount":0},{"upTo":null,"amount":200}]',NULL,'2024-04-01','KA PT slabs'),
  ('IN','PT','slabs_Maharashtra','[{"upTo":7500,"amount":0},{"upTo":10000,"amount":175},{"upTo":null,"amount":200}]',NULL,'2024-04-01','MH PT slabs'),
  ('IN','PT','slabs_West Bengal','[{"upTo":10000,"amount":0},{"upTo":15000,"amount":110},{"upTo":25000,"amount":130},{"upTo":40000,"amount":150},{"upTo":null,"amount":200}]',NULL,'2024-04-01','WB PT slabs'),
  ('IN','PT','slabs_Tamil Nadu','[{"upTo":21000,"amount":0},{"upTo":30000,"amount":135},{"upTo":45000,"amount":315},{"upTo":60000,"amount":690},{"upTo":75000,"amount":1025},{"upTo":null,"amount":1250}]',NULL,'2024-04-01','TN PT half-yearly prorated (illustrative monthly)'),
  ('IN','PT','slabs_Telangana','[{"upTo":15000,"amount":0},{"upTo":20000,"amount":150},{"upTo":null,"amount":200}]',NULL,'2024-04-01','TS PT slabs'),
-- UK NI / pension / student loans (2026/27 illustrative)
  ('GB','NI','primary_threshold_monthly','1048',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','NI','upper_earnings_limit_monthly','4189',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','NI','employee_main_pct','0.08',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','NI','employee_upper_pct','0.02',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','NI','secondary_threshold_monthly','417',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','NI','employer_pct','0.15',NULL,'2026-04-06','HMRC (illustrative)'),
  ('GB','PENSION','qualifying_lower_annual','6240',NULL,'2026-04-06','TPR auto-enrolment band'),
  ('GB','PENSION','qualifying_upper_annual','50270',NULL,'2026-04-06','TPR auto-enrolment band'),
  ('GB','PENSION','min_employee_pct','0.05',NULL,'2026-04-06','TPR minimum'),
  ('GB','PENSION','min_employer_pct','0.03',NULL,'2026-04-06','TPR minimum'),
  ('GB','STUDENT_LOAN','plan1_threshold_annual','26065',NULL,'2026-04-06','SLC (illustrative)'),
  ('GB','STUDENT_LOAN','plan2_threshold_annual','28470',NULL,'2026-04-06','SLC (illustrative)'),
  ('GB','STUDENT_LOAN','plan4_threshold_annual','32745',NULL,'2026-04-06','SLC (illustrative)'),
  ('GB','STUDENT_LOAN','plan_rate_pct','0.09',NULL,'2026-04-06','Plans 1/2/4'),
  ('GB','STUDENT_LOAN','pgl_threshold_annual','21000',NULL,'2026-04-06','Postgraduate loan'),
  ('GB','STUDENT_LOAN','pgl_rate_pct','0.06',NULL,'2026-04-06','Postgraduate loan'),
-- US FICA / FUTA / SUTA / 401k (2026 illustrative)
  ('US','FICA','ss_rate_pct','0.062',NULL,'2026-01-01','SSA'),
  ('US','FICA','ss_wage_base_limit','184500',NULL,'2026-01-01','SSA (illustrative)'),
  ('US','FICA','medicare_rate_pct','0.0145',NULL,'2026-01-01','IRS'),
  ('US','FICA','medicare_additional_pct','0.009',NULL,'2026-01-01','IRS'),
  ('US','FICA','medicare_additional_threshold','200000',NULL,'2026-01-01','IRS'),
  ('US','FUTA','rate_pct','0.006',NULL,'2026-01-01','IRS — 6.0% less 5.4% credit'),
  ('US','FUTA','wage_base','7000',NULL,'2026-01-01','IRS'),
  ('US','SUTA','default_rate_pct','0.027',NULL,'2026-01-01','Company-specific rate; state assigns'),
  ('US','SUTA','default_wage_base','7000',NULL,'2026-01-01','Varies by state — company setting'),
  ('US','K401','annual_limit','24000',NULL,'2026-01-01','IRS 402(g) (illustrative)')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Tax rules + slabs
-- ------------------------------------------------------------
-- India TDS FY2026-27 (illustrative)
WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, regime, calculation_method, annualization, extras, effective_from)
  VALUES ('IN','IN_TDS','Income Tax (TDS)','FY2026-27','new','slab','annualize_ytd',
          '{"standard_deduction":75000,"rebate_87a_limit":1200000,"cess_pct":4}','2026-04-01')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 400000, 0), (2, 400000, 800000, 5), (3, 800000, 1200000, 10),
  (4, 1200000, 1600000, 15), (5, 1600000, 2000000, 20), (6, 2000000, 2400000, 25),
  (7, 2400000, NULL::numeric, 30)
) AS s(ord, f, t, r);

WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, regime, calculation_method, annualization, extras, effective_from)
  VALUES ('IN','IN_TDS','Income Tax (TDS)','FY2026-27','old','slab','annualize_ytd',
          '{"standard_deduction":50000,"cess_pct":4,"rebate_87a_limit":500000}','2026-04-01')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 250000, 0), (2, 250000, 500000, 5), (3, 500000, 1000000, 20), (4, 1000000, NULL::numeric, 30)
) AS s(ord, f, t, r);

-- UK PAYE 2026/27 (rUK bands, illustrative)
WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, calculation_method, annualization, extras, effective_from)
  VALUES ('GB','GB_PAYE','PAYE Income Tax','2026/27','slab','cumulative',
          '{"personal_allowance":12570,"allowance_taper_from":100000}','2026-04-06')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 37700, 20), (2, 37700, 125140, 40), (3, 125140, NULL::numeric, 45)
) AS s(ord, f, t, r);

-- US Federal 2026 (percentage-method shape, illustrative)
WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, regime, calculation_method, annualization, extras, effective_from)
  VALUES ('US','US_FED','Federal Income Tax','2026','single','slab','annualize_ytd',
          '{"standard_deduction":16100}','2026-01-01')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 12400, 10), (2, 12400, 50400, 12), (3, 50400, 105700, 22),
  (4, 105700, 201775, 24), (5, 201775, 256225, 32), (6, 256225, 640600, 35),
  (7, 640600, NULL::numeric, 37)
) AS s(ord, f, t, r);

WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, regime, calculation_method, annualization, extras, effective_from)
  VALUES ('US','US_FED','Federal Income Tax','2026','married_joint','slab','annualize_ytd',
          '{"standard_deduction":32200}','2026-01-01')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 24800, 10), (2, 24800, 100800, 12), (3, 100800, 211400, 22),
  (4, 211400, 403550, 24), (5, 403550, 512450, 32), (6, 512450, 768700, 35),
  (7, 768700, NULL::numeric, 37)
) AS s(ord, f, t, r);

-- US state examples: CA slab; CO/IL/PA flat (no-income-tax states have no rows)
WITH r AS (
  INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, jurisdiction, calculation_method, annualization, extras, effective_from)
  VALUES ('US','US_STATE','California State Tax','2026','CA','slab','annualize_ytd','{"standard_deduction":5540}','2026-01-01')
  ON CONFLICT DO NOTHING
  RETURNING id
)
INSERT INTO tax_slabs (tax_rule_id, slab_order, income_from, income_to, rate_pct)
SELECT id, s.ord, s.f, s.t, s.r FROM r, (VALUES
  (1, 0, 10756, 1), (2, 10756, 25499, 2), (3, 25499, 40245, 4),
  (4, 40245, 55866, 6), (5, 55866, 70606, 8), (6, 70606, 360659, 9.3),
  (7, 360659, NULL::numeric, 10.3)
) AS s(ord, f, t, r);

INSERT INTO tax_rules (country_code, tax_code, tax_name, tax_year, jurisdiction, calculation_method, flat_rate, annualization, effective_from)
VALUES
  ('US','US_STATE','Colorado State Tax','2026','CO','flat_rate',0.044,'annualize_ytd','2026-01-01'),
  ('US','US_STATE','Illinois State Tax','2026','IL','flat_rate',0.0495,'annualize_ytd','2026-01-01'),
  ('US','US_STATE','Pennsylvania State Tax','2026','PA','flat_rate',0.0307,'annualize_ytd','2026-01-01'),
  ('US','US_STATE','Georgia State Tax','2026','GA','flat_rate',0.0539,'annualize_ytd','2026-01-01')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
