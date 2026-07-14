-- ============================================================
-- 34: Country-scoped payroll components, structures, assignments (Phase 3)
-- ============================================================

CREATE TABLE IF NOT EXISTS payroll_components (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code              char(2) REFERENCES countries(code),
  company_id                uuid REFERENCES companies(id) ON DELETE CASCADE,
  component_code            text NOT NULL,
  component_name            text NOT NULL,
  component_name_i18n       jsonb NOT NULL DEFAULT '{}',
  component_type            text NOT NULL
                              CHECK (component_type IN ('earning','deduction','employer_contribution','provision')),
  calculation_type          text NOT NULL DEFAULT 'fixed'
                              CHECK (calculation_type IN ('fixed','percentage','formula','statutory')),
  formula                   text,
  statutory_function        text,
  percentage_of             text,
  default_value             numeric(14,4) NOT NULL DEFAULT 0,
  is_taxable                boolean NOT NULL DEFAULT true,
  is_statutory              boolean NOT NULL DEFAULT false,
  is_recurring              boolean NOT NULL DEFAULT true,
  is_prorated               boolean NOT NULL DEFAULT true,
  include_in_social_base    boolean NOT NULL DEFAULT false,
  include_in_eosb_base      boolean NOT NULL DEFAULT false,
  calculation_order         integer NOT NULL DEFAULT 100,
  rounding_rule             text NOT NULL DEFAULT 'half_up'
                              CHECK (rounding_rule IN ('half_up','half_down','ceil','floor','none')),
  rounding_precision        smallint,
  applicable_employee_types text[],
  applicable_nationality    text,
  statutory_module_code     text,
  effective_from            date NOT NULL DEFAULT '2020-01-01',
  effective_to              date,
  is_active                 boolean NOT NULL DEFAULT true,
  display_order             integer NOT NULL DEFAULT 0,
  created_at                timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (component_code, country_code, company_id, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_pc_country ON payroll_components(country_code, company_id, is_active);

CREATE TABLE IF NOT EXISTS payroll_structures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL REFERENCES countries(code),
  name         text NOT NULL,
  description  text,
  is_default   boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS payroll_structure_components (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id   uuid NOT NULL REFERENCES payroll_structures(id) ON DELETE CASCADE,
  component_id   uuid NOT NULL REFERENCES payroll_components(id) ON DELETE CASCADE,
  default_value  numeric(14,4),
  is_overridable boolean NOT NULL DEFAULT true,
  UNIQUE (structure_id, component_id)
);

CREATE TABLE IF NOT EXISTS employee_payroll_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  structure_id   uuid REFERENCES payroll_structures(id) ON DELETE SET NULL,
  component_id   uuid NOT NULL REFERENCES payroll_components(id) ON DELETE CASCADE,
  value          numeric(14,4),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to   date,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (employee_id, component_id, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_epa_employee ON employee_payroll_assignments(employee_id, effective_from);

ALTER TABLE payroll_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY pc_read ON payroll_components FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
CREATE POLICY pc_company_write ON payroll_components FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
CREATE POLICY pc_platform_write ON payroll_components FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

ALTER TABLE payroll_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps2_all ON payroll_structures FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

ALTER TABLE payroll_structure_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY psc_all ON payroll_structure_components FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM payroll_structures s WHERE s.id = structure_id AND s.company_id = get_current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM payroll_structures s WHERE s.id = structure_id AND s.company_id = get_current_company_id()));

ALTER TABLE employee_payroll_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY epa_all ON employee_payroll_assignments FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());

INSERT INTO payroll_components
  (country_code, component_code, component_name, component_type, calculation_type,
   formula, statutory_function, is_taxable, include_in_social_base, include_in_eosb_base,
   calculation_order, applicable_nationality, is_statutory, statutory_module_code, display_order, is_recurring, is_prorated)
SELECT v.country, v.code, v.name, v.ctype, v.calc, v.formula, v.stat_fn,
       v.taxable, v.social, v.eosb, v.ord, v.nat,
       v.calc = 'statutory', v.module, v.ord,
       v.code NOT IN ('BONUS','COMMISSION','ADV'),
       v.ctype = 'earning' AND v.code NOT IN ('OT','BONUS','COMMISSION')
FROM (VALUES
  ('BH','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('BH','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,true,false,20,NULL,NULL),
  ('BH','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('BH','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('BH','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('BH','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('BH','GOSI_EE','GOSI (Employee)','deduction','statutory',NULL,'CALCULATE_GOSI',false,false,false,100,NULL,'GOSI'),
  ('BH','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('BH','ADV','Salary Advance','deduction','fixed',NULL,NULL,false,false,false,120,NULL,NULL),
  ('BH','ABSENCE','Absence Deduction','deduction','formula','ROUND(BASIC / CALENDAR_DAYS * ABSENT_DAYS, 3)',NULL,false,false,false,130,NULL,NULL),
  ('BH','GOSI_ER','GOSI (Employer)','employer_contribution','statutory',NULL,'CALCULATE_GOSI',false,false,false,200,NULL,'GOSI'),
  ('BH','LMRA_FEE','LMRA Fee','employer_contribution','fixed',NULL,NULL,false,false,false,210,'expat','LMRA'),
  ('BH','EOSB_PROV','EOSB Provision','provision','statutory',NULL,'CALCULATE_EOSB',false,false,false,220,'expat',NULL),
  ('AE','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('AE','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,false,false,20,NULL,NULL),
  ('AE','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('AE','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('AE','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('AE','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('AE','GPSSA_EE','GPSSA Pension (Employee)','deduction','statutory',NULL,'CALCULATE_GPSSA',false,false,false,100,'citizen','GPSSA'),
  ('AE','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('AE','ADV','Salary Advance','deduction','fixed',NULL,NULL,false,false,false,120,NULL,NULL),
  ('AE','ABSENCE','Absence Deduction','deduction','formula','ROUND(GROSS / CALENDAR_DAYS * ABSENT_DAYS, 2)',NULL,false,false,false,130,NULL,NULL),
  ('AE','GPSSA_ER','GPSSA Pension (Employer)','employer_contribution','statutory',NULL,'CALCULATE_GPSSA',false,false,false,200,'citizen','GPSSA'),
  ('AE','MED_INS','Medical Insurance','employer_contribution','fixed',NULL,NULL,false,false,false,210,NULL,'MED_INS_MANDATE'),
  ('AE','GRATUITY_PROV','End of Service Provision','provision','statutory',NULL,'CALCULATE_GRATUITY',false,false,false,220,'expat',NULL),
  ('SA','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('SA','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,true,false,20,NULL,NULL),
  ('SA','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('SA','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('SA','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('SA','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('SA','GOSI_EE','GOSI (Employee)','deduction','statutory',NULL,'CALCULATE_GOSI',false,false,false,100,'citizen','GOSI'),
  ('SA','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('SA','ABSENCE','Absence Deduction','deduction','formula','ROUND(BASIC / 30 * ABSENT_DAYS, 2)',NULL,false,false,false,120,NULL,NULL),
  ('SA','GOSI_ER','GOSI (Employer)','employer_contribution','statutory',NULL,'CALCULATE_GOSI',false,false,false,200,NULL,'GOSI'),
  ('SA','EOSB_PROV','EOSB Provision','provision','statutory',NULL,'CALCULATE_EOSB',false,false,false,210,NULL,NULL),
  ('OM','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('OM','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,false,false,20,NULL,NULL),
  ('OM','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('OM','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('OM','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('OM','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('OM','PASI_EE','PASI (Employee)','deduction','statutory',NULL,'CALCULATE_PASI',false,false,false,100,'citizen','PASI'),
  ('OM','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('OM','ABSENCE','Absence Deduction','deduction','formula','ROUND(BASIC / 30 * ABSENT_DAYS, 3)',NULL,false,false,false,120,NULL,NULL),
  ('OM','PASI_ER','PASI (Employer)','employer_contribution','statutory',NULL,'CALCULATE_PASI',false,false,false,200,'citizen','PASI'),
  ('OM','EOSB_PROV','EOSB Provision','provision','statutory',NULL,'CALCULATE_EOSB',false,false,false,210,'expat',NULL),
  ('QA','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('QA','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,false,false,20,NULL,NULL),
  ('QA','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('QA','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('QA','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('QA','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('QA','PENSION_EE','Pension (Employee)','deduction','statutory',NULL,'CALCULATE_QA_PENSION',false,false,false,100,'citizen','PENSION'),
  ('QA','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('QA','ABSENCE','Absence Deduction','deduction','formula','ROUND(BASIC / 30 * ABSENT_DAYS, 2)',NULL,false,false,false,120,NULL,NULL),
  ('QA','PENSION_ER','Pension (Employer)','employer_contribution','statutory',NULL,'CALCULATE_QA_PENSION',false,false,false,200,'citizen','PENSION'),
  ('QA','EOSB_PROV','EOSB Provision','provision','statutory',NULL,'CALCULATE_EOSB',false,false,false,210,'expat',NULL),
  ('KW','BASIC','Basic Salary','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('KW','HOUSING','Housing Allowance','earning','fixed',NULL,NULL,true,false,false,20,NULL,NULL),
  ('KW','TRANSPORT','Transport Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('KW','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('KW','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('KW','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,60,NULL,NULL),
  ('KW','PIFSS_EE','PIFSS (Employee)','deduction','statutory',NULL,'CALCULATE_PIFSS',false,false,false,100,'citizen','PIFSS'),
  ('KW','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,110,NULL,NULL),
  ('KW','ABSENCE','Absence Deduction','deduction','formula','ROUND(BASIC / 26 * ABSENT_DAYS, 3)',NULL,false,false,false,120,NULL,NULL),
  ('KW','PIFSS_ER','PIFSS (Employer)','employer_contribution','statutory',NULL,'CALCULATE_PIFSS',false,false,false,200,'citizen','PIFSS'),
  ('KW','EOSB_PROV','Indemnity Provision','provision','statutory',NULL,'CALCULATE_EOSB',false,false,false,210,NULL,NULL),
  ('IN','BASIC','Basic','earning','fixed',NULL,NULL,true,true,true,10,NULL,NULL),
  ('IN','HRA','House Rent Allowance','earning','formula','ROUND(BASIC * 0.5, 2)',NULL,true,false,false,20,NULL,NULL),
  ('IN','CONVEYANCE','Conveyance Allowance','earning','fixed',NULL,NULL,true,false,false,30,NULL,NULL),
  ('IN','MEDICAL_ALW','Medical Allowance','earning','fixed',NULL,NULL,true,false,false,40,NULL,NULL),
  ('IN','SPECIAL_ALW','Special Allowance','earning','fixed',NULL,NULL,true,false,false,50,NULL,NULL),
  ('IN','FOOD_ALW','Food Allowance','earning','fixed',NULL,NULL,true,false,false,55,NULL,NULL),
  ('IN','OTHER_ALW','Other Allowance','earning','fixed',NULL,NULL,true,false,false,58,NULL,NULL),
  ('IN','BONUS','Bonus','earning','fixed',NULL,NULL,true,false,false,60,NULL,NULL),
  ('IN','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,false,false,70,NULL,NULL),
  ('IN','PF_EE','Provident Fund','deduction','statutory',NULL,'CALCULATE_PF',false,false,false,100,NULL,'PF'),
  ('IN','ESI_EE','ESI','deduction','statutory',NULL,'CALCULATE_ESI',false,false,false,110,NULL,'ESI'),
  ('IN','PT','Professional Tax','deduction','statutory',NULL,'CALCULATE_PT',false,false,false,120,NULL,'PT'),
  ('IN','TDS','Income Tax (TDS)','deduction','statutory',NULL,'CALCULATE_TDS',false,false,false,130,NULL,'TDS'),
  ('IN','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,140,NULL,NULL),
  ('IN','ADV','Salary Advance','deduction','fixed',NULL,NULL,false,false,false,150,NULL,NULL),
  ('IN','ABSENCE','Absence Deduction (LOP)','deduction','formula','ROUND(GROSS / CALENDAR_DAYS * ABSENT_DAYS, 2)',NULL,false,false,false,160,NULL,NULL),
  ('IN','PF_ER','Employer PF','employer_contribution','statutory',NULL,'CALCULATE_PF',false,false,false,200,NULL,'PF'),
  ('IN','ESI_ER','Employer ESI','employer_contribution','statutory',NULL,'CALCULATE_ESI',false,false,false,210,NULL,'ESI'),
  ('IN','GRATUITY_PROV','Gratuity Provision','provision','statutory',NULL,'CALCULATE_GRATUITY',false,false,false,220,NULL,NULL),
  ('IN','BONUS_PROV','Bonus Provision','provision','formula','ROUND(MIN(BASIC, 7000) * 0.0833, 2)',NULL,false,false,false,230,NULL,NULL),
  ('GB','BASIC','Basic Pay','earning','fixed',NULL,NULL,true,true,false,10,NULL,NULL),
  ('GB','OT','Overtime','earning','formula','BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER',NULL,true,true,false,20,NULL,NULL),
  ('GB','BONUS','Bonus','earning','fixed',NULL,NULL,true,true,false,30,NULL,NULL),
  ('GB','OTHER_ALW','Allowance','earning','fixed',NULL,NULL,true,true,false,40,NULL,NULL),
  ('GB','PAYE','PAYE Income Tax','deduction','statutory',NULL,'CALCULATE_PAYE',false,false,false,100,NULL,'PAYE'),
  ('GB','NI_EE','National Insurance','deduction','statutory',NULL,'CALCULATE_NI',false,false,false,110,NULL,'NI'),
  ('GB','PENSION_EE','Pension (Employee)','deduction','statutory',NULL,'CALCULATE_PENSION_AE',false,false,false,120,NULL,'PENSION'),
  ('GB','STUDENT_LOAN','Student Loan','deduction','statutory',NULL,'CALCULATE_STUDENT_LOAN',false,false,false,130,NULL,'STUDENT_LOAN'),
  ('GB','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,140,NULL,NULL),
  ('GB','NI_ER','Employer NI','employer_contribution','statutory',NULL,'CALCULATE_NI',false,false,false,200,NULL,'NI'),
  ('GB','PENSION_ER','Employer Pension','employer_contribution','statutory',NULL,'CALCULATE_PENSION_AE',false,false,false,210,NULL,'PENSION'),
  ('US','BASIC','Regular Pay','earning','fixed',NULL,NULL,true,true,false,10,NULL,NULL),
  ('US','OT','Overtime Pay','earning','statutory',NULL,'CALCULATE_FLSA_OT',true,true,false,20,NULL,NULL),
  ('US','BONUS','Bonus','earning','fixed',NULL,NULL,true,true,false,30,NULL,NULL),
  ('US','COMMISSION','Commission','earning','fixed',NULL,NULL,true,true,false,40,NULL,NULL),
  ('US','OTHER_ALW','Allowance','earning','fixed',NULL,NULL,true,true,false,50,NULL,NULL),
  ('US','K401_EE','401(k) Contribution','deduction','formula','ROUND(GROSS * K401_PCT / 100, 2)',NULL,false,false,false,90,NULL,'K401'),
  ('US','HEALTH_INS_EE','Health Insurance (Employee)','deduction','fixed',NULL,NULL,false,false,false,95,NULL,NULL),
  ('US','FED_TAX','Federal Income Tax','deduction','statutory',NULL,'CALCULATE_FEDERAL_TAX',false,false,false,100,NULL,'FED_WH'),
  ('US','STATE_TAX','State Income Tax','deduction','statutory',NULL,'CALCULATE_STATE_TAX',false,false,false,110,NULL,'STATE_WH'),
  ('US','SS_EE','Social Security','deduction','statutory',NULL,'CALCULATE_FICA',false,false,false,120,NULL,'FICA'),
  ('US','MEDICARE_EE','Medicare','deduction','statutory',NULL,'CALCULATE_FICA',false,false,false,130,NULL,'FICA'),
  ('US','LOAN','Loan Deduction','deduction','fixed',NULL,NULL,false,false,false,140,NULL,NULL),
  ('US','SS_ER','Employer Social Security','employer_contribution','statutory',NULL,'CALCULATE_FICA',false,false,false,200,NULL,'FICA'),
  ('US','MEDICARE_ER','Employer Medicare','employer_contribution','statutory',NULL,'CALCULATE_FICA',false,false,false,210,NULL,'FICA'),
  ('US','FUTA','Federal Unemployment (FUTA)','employer_contribution','statutory',NULL,'CALCULATE_FUTA',false,false,false,220,NULL,'FUTA'),
  ('US','SUTA','State Unemployment (SUTA)','employer_contribution','statutory',NULL,'CALCULATE_SUTA',false,false,false,230,NULL,'SUTA'),
  ('US','K401_MATCH','401(k) Employer Match','employer_contribution','formula','ROUND(MIN(K401_EE, GROSS * K401_MATCH_PCT / 100), 2)',NULL,false,false,false,240,NULL,'K401')
) AS v(country, code, name, ctype, calc, formula, stat_fn, taxable, social, eosb, ord, nat, module)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  comp RECORD;
  struct_id uuid;
  cc char(2);
BEGIN
  FOR comp IN SELECT id, country_code FROM companies LOOP
    cc := COALESCE(NULLIF(comp.country_code, ''), 'BH');
    IF NOT EXISTS (SELECT 1 FROM payroll_components pc WHERE pc.country_code = cc AND pc.company_id IS NULL) THEN
      CONTINUE;
    END IF;

    INSERT INTO payroll_structures (company_id, country_code, name, description, is_default)
    VALUES (comp.id, cc, 'Default Structure', 'Auto-created from legacy salary columns', true)
    ON CONFLICT (company_id, name) DO NOTHING;

    SELECT id INTO struct_id FROM payroll_structures WHERE company_id = comp.id AND name = 'Default Structure';

    INSERT INTO payroll_structure_components (structure_id, component_id)
    SELECT struct_id, pc.id FROM payroll_components pc
    WHERE pc.country_code = cc AND pc.company_id IS NULL AND pc.is_active
    ON CONFLICT DO NOTHING;

    INSERT INTO employee_payroll_assignments (company_id, employee_id, structure_id, component_id, value)
    SELECT e.company_id, e.id, struct_id, pc.id,
           CASE pc.component_code
             WHEN 'BASIC' THEN COALESCE(e.basic_salary, 0)
             WHEN 'HOUSING' THEN COALESCE(e.housing_allowance, 0)
             WHEN 'TRANSPORT' THEN COALESCE(e.transport_allowance, 0)
             WHEN 'FOOD_ALW' THEN COALESCE(e.food_allowance, 0)
             WHEN 'OTHER_ALW' THEN COALESCE(e.other_allowances, 0)
           END
    FROM employees e
    JOIN payroll_components pc
      ON pc.country_code = cc AND pc.company_id IS NULL
     AND pc.component_code IN ('BASIC','HOUSING','TRANSPORT','FOOD_ALW','OTHER_ALW')
    WHERE e.company_id = comp.id
      AND (pc.component_code = 'BASIC'
           OR (pc.component_code = 'HOUSING' AND COALESCE(e.housing_allowance, 0) <> 0)
           OR (pc.component_code = 'TRANSPORT' AND COALESCE(e.transport_allowance, 0) <> 0)
           OR (pc.component_code = 'FOOD_ALW' AND COALESCE(e.food_allowance, 0) <> 0)
           OR (pc.component_code = 'OTHER_ALW' AND COALESCE(e.other_allowances, 0) <> 0))
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';