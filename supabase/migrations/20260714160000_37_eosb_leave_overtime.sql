-- ============================================================
-- 37: EOSB/gratuity rules, leave policy templates, holiday
--     calendars, overtime rules (Phase 6)
-- ============================================================

-- ------------------------------------------------------------
-- EOSB / gratuity band rules (one generic engine, data per country)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eosb_rules (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code           char(2) NOT NULL REFERENCES countries(code),
  company_id             uuid REFERENCES companies(id) ON DELETE CASCADE,
  rule_code              text NOT NULL,          -- 'BH_EOSB','AE_GRATUITY','IN_GRATUITY'...
  rule_name              text NOT NULL,
  eligibility_months     integer NOT NULL DEFAULT 12,
  calculation_base       text NOT NULL DEFAULT 'basic'
                           CHECK (calculation_base IN ('basic','basic_plus_flagged','gross','last_drawn','custom_formula')),
  base_formula           text,
  day_divisor            numeric(6,3) NOT NULL DEFAULT 30,   -- GCC 30; IN gratuity 26
  accrual_method         text NOT NULL DEFAULT 'monthly_provision'
                           CHECK (accrual_method IN ('monthly_provision','on_settlement_only')),
  -- [{"fromYears":0,"toYears":3,"daysPerYear":15}, {"fromYears":3,"toYears":null,"daysPerYear":30}]
  tier_bands             jsonb NOT NULL DEFAULT '[]',
  -- [{"reason":"Termination","factor":1},
  --  {"reason":"Resignation","byService":[{"fromYears":0,"toYears":3,"factor":0.3333},...]}]
  termination_factors    jsonb NOT NULL DEFAULT '[]',
  nationality_dependency text,          -- 'expat_only' | NULL
  round_year_after_months integer,      -- IN: service > 6 months counts as a full year
  max_amount             numeric(14,2), -- IN statutory cap
  max_years_pay_cap      numeric(5,2),  -- AE: total ≤ 2 years' pay
  effective_from         date NOT NULL DEFAULT '2020-01-01',
  effective_to           date,
  is_active              boolean NOT NULL DEFAULT true,
  notes                  text,
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, rule_code, effective_from)
);

ALTER TABLE eosb_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS er_read ON eosb_rules;
CREATE POLICY er_read ON eosb_rules FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS er_company_write ON eosb_rules;
CREATE POLICY er_company_write ON eosb_rules FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS er_platform_write ON eosb_rules;
CREATE POLICY er_platform_write ON eosb_rules FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO eosb_rules
  (country_code, rule_code, rule_name, eligibility_months, calculation_base, day_divisor,
   accrual_method, tier_bands, termination_factors, nationality_dependency,
   round_year_after_months, max_amount, max_years_pay_cap, notes)
VALUES
  ('BH','BH_EOSB','End of Service Indemnity (Labour Law Art. 116)',12,'basic',30,'monthly_provision',
   '[{"fromYears":0,"toYears":3,"daysPerYear":15},{"fromYears":3,"toYears":null,"daysPerYear":30}]',
   '[{"reason":"Termination","factor":1},
     {"reason":"Resignation","byService":[{"fromYears":0,"toYears":3,"factor":0.3333},{"fromYears":3,"toYears":5,"factor":0.6667},{"fromYears":5,"toYears":null,"factor":1}]}]',
   NULL,NULL,NULL,NULL,
   'Bahraini nationals covered by GOSI pension may be treated differently — configurable'),
  ('AE','AE_GRATUITY','End of Service Gratuity (UAE Labour Law)',12,'basic',30,'monthly_provision',
   '[{"fromYears":0,"toYears":5,"daysPerYear":21},{"fromYears":5,"toYears":null,"daysPerYear":30}]',
   '[{"reason":"Termination","factor":1},{"reason":"Resignation","factor":1}]',
   'expat_only',NULL,NULL,2,
   'Post-2022 decree: full gratuity on resignation; capped at 2 years'' pay'),
  ('SA','SA_EOSB','End of Service Benefit (Saudi Labour Law Art. 84-85)',0,'gross',30,'monthly_provision',
   '[{"fromYears":0,"toYears":5,"daysPerYear":15},{"fromYears":5,"toYears":null,"daysPerYear":30}]',
   '[{"reason":"Termination","factor":1},
     {"reason":"Resignation","byService":[{"fromYears":0,"toYears":2,"factor":0},{"fromYears":2,"toYears":5,"factor":0.3333},{"fromYears":5,"toYears":10,"factor":0.6667},{"fromYears":10,"toYears":null,"factor":1}]}]',
   NULL,NULL,NULL,NULL,
   'Half month per year first 5 years, full month after; wage = last basic + fixed allowances'),
  ('OM','OM_EOSB','End of Service Benefit (Oman Labour Law)',12,'basic',30,'monthly_provision',
   '[{"fromYears":0,"toYears":null,"daysPerYear":30}]',
   '[{"reason":"Termination","factor":1},{"reason":"Resignation","factor":1}]',
   'expat_only',NULL,NULL,NULL,
   '2023 law: one month basic per year of service for expats (illustrative)'),
  ('QA','QA_EOSB','End of Service Gratuity (Qatar Labour Law Art. 54)',12,'basic',30,'monthly_provision',
   '[{"fromYears":0,"toYears":null,"daysPerYear":21}]',
   '[{"reason":"Termination","factor":1},{"reason":"Resignation","factor":1}]',
   'expat_only',NULL,NULL,NULL,
   'Minimum 3 weeks'' basic wage per year of service'),
  ('KW','KW_INDEMNITY','Termination Indemnity (Kuwait Labour Law)',0,'gross',26,'monthly_provision',
   '[{"fromYears":0,"toYears":5,"daysPerYear":15},{"fromYears":5,"toYears":null,"daysPerYear":30}]',
   '[{"reason":"Termination","factor":1},
     {"reason":"Resignation","byService":[{"fromYears":0,"toYears":3,"factor":0},{"fromYears":3,"toYears":5,"factor":0.5},{"fromYears":5,"toYears":10,"factor":0.6667},{"fromYears":10,"toYears":null,"factor":1}]}]',
   NULL,NULL,NULL,1.5,
   '15 days/yr first 5 years then 1 month/yr, capped at 1.5 years'' pay; day divisor 26 for monthly-paid'),
  ('IN','IN_GRATUITY','Gratuity (Payment of Gratuity Act 1972)',57,'basic',26,'monthly_provision',
   '[{"fromYears":0,"toYears":null,"daysPerYear":15}]',
   '[{"reason":"Any","factor":1}]',
   NULL,6,2000000,NULL,
   '15/26 × last drawn (basic+DA) × years; >6 months rounds up; ₹20 lakh statutory cap'),
  ('GB','GB_FINAL_PAY','Final Pay Settlement',0,'custom_formula',1,'on_settlement_only',
   '[]','[]',NULL,NULL,NULL,NULL,
   'No statutory gratuity — final pay = prorated pay + accrued holiday; statutory redundancy configurable separately'),
  ('US','US_FINAL_PAY','Final Pay & PTO Payout',0,'custom_formula',1,'on_settlement_only',
   '[]','[]',NULL,NULL,NULL,NULL,
   'Final pay + PTO payout per state rule/company policy; 401(k) settlement informational')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Leave policy templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_policy_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code         char(2) NOT NULL REFERENCES countries(code),
  company_id           uuid REFERENCES companies(id) ON DELETE CASCADE,
  leave_code           text NOT NULL,
  leave_name           text NOT NULL,
  days_per_year        numeric(6,2) NOT NULL,
  paid_tiers           jsonb,     -- [{"days":15,"payPct":100},...]
  gender_specific      text NOT NULL DEFAULT 'All' CHECK (gender_specific IN ('All','Male','Female')),
  eligibility_months   integer NOT NULL DEFAULT 0,
  accrual_method       text NOT NULL DEFAULT 'annual_grant'
                         CHECK (accrual_method IN ('annual_grant','monthly_accrual','per_hours_worked')),
  carry_forward        boolean NOT NULL DEFAULT false,
  max_carry_forward    numeric(6,2) DEFAULT 0,
  encashment_allowed   boolean NOT NULL DEFAULT false,
  counts_weekends      boolean NOT NULL DEFAULT true,
  is_statutory         boolean NOT NULL DEFAULT false,
  statutory_ref        text,
  is_active            boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, leave_code)
);

ALTER TABLE leave_policy_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lpt_read ON leave_policy_templates;
CREATE POLICY lpt_read ON leave_policy_templates FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS lpt_company_write ON leave_policy_templates;
CREATE POLICY lpt_company_write ON leave_policy_templates FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS lpt_platform_write ON leave_policy_templates;
CREATE POLICY lpt_platform_write ON leave_policy_templates FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO leave_policy_templates
  (country_code, leave_code, leave_name, days_per_year, paid_tiers, gender_specific,
   eligibility_months, accrual_method, carry_forward, max_carry_forward, encashment_allowed, is_statutory, statutory_ref)
VALUES
  ('BH','ANNUAL','Annual Leave',30,NULL,'All',3,'monthly_accrual',true,15,true,true,'BH Labour Law Art. 58'),
  ('BH','SICK','Sick Leave',55,'[{"days":15,"payPct":100},{"days":20,"payPct":50},{"days":20,"payPct":0}]','All',3,'annual_grant',false,0,false,true,'BH Labour Law Art. 65'),
  ('BH','MATERNITY','Maternity Leave',60,'[{"days":60,"payPct":100}]','Female',0,'annual_grant',false,0,false,true,'BH Labour Law Art. 32'),
  ('BH','HAJJ','Hajj Leave',14,NULL,'All',60,'annual_grant',false,0,false,true,'Once per service'),
  ('AE','ANNUAL','Annual Leave',30,NULL,'All',6,'monthly_accrual',true,30,true,true,'UAE Labour Law Art. 29'),
  ('AE','SICK','Sick Leave',90,'[{"days":15,"payPct":100},{"days":30,"payPct":50},{"days":45,"payPct":0}]','All',3,'annual_grant',false,0,false,true,'UAE Labour Law Art. 31'),
  ('AE','MATERNITY','Maternity Leave',60,'[{"days":45,"payPct":100},{"days":15,"payPct":50}]','Female',0,'annual_grant',false,0,false,true,'UAE Labour Law Art. 30'),
  ('AE','PARENTAL','Parental Leave',5,NULL,'All',0,'annual_grant',false,0,false,true,'UAE Labour Law Art. 32'),
  ('SA','ANNUAL','Annual Leave',21,NULL,'All',0,'monthly_accrual',true,10,true,true,'Saudi Labour Law Art. 109 (30 after 5 yrs)'),
  ('SA','SICK','Sick Leave',120,'[{"days":30,"payPct":100},{"days":60,"payPct":75},{"days":30,"payPct":0}]','All',0,'annual_grant',false,0,false,true,'Saudi Labour Law Art. 117'),
  ('SA','MATERNITY','Maternity Leave',70,'[{"days":70,"payPct":100}]','Female',0,'annual_grant',false,0,false,true,'Saudi Labour Law'),
  ('OM','ANNUAL','Annual Leave',30,NULL,'All',6,'monthly_accrual',true,15,true,true,'Oman Labour Law'),
  ('OM','SICK','Sick Leave',182,'[{"days":21,"payPct":100},{"days":21,"payPct":75},{"days":21,"payPct":50},{"days":119,"payPct":0}]','All',0,'annual_grant',false,0,false,true,'Oman Labour Law'),
  ('OM','MATERNITY','Maternity Leave',98,'[{"days":98,"payPct":100}]','Female',0,'annual_grant',false,0,false,true,'Oman Labour Law 2023'),
  ('QA','ANNUAL','Annual Leave',21,NULL,'All',12,'monthly_accrual',true,10,true,true,'Qatar Labour Law Art. 79 (28 after 5 yrs)'),
  ('QA','SICK','Sick Leave',84,'[{"days":14,"payPct":100},{"days":28,"payPct":50},{"days":42,"payPct":0}]','All',3,'annual_grant',false,0,false,true,'Qatar Labour Law Art. 82'),
  ('QA','MATERNITY','Maternity Leave',50,'[{"days":50,"payPct":100}]','Female',12,'annual_grant',false,0,false,true,'Qatar Labour Law Art. 96'),
  ('KW','ANNUAL','Annual Leave',30,NULL,'All',9,'monthly_accrual',true,15,true,true,'Kuwait Labour Law Art. 70'),
  ('KW','SICK','Sick Leave',75,'[{"days":15,"payPct":100},{"days":10,"payPct":75},{"days":10,"payPct":50},{"days":10,"payPct":25},{"days":30,"payPct":0}]','All',0,'annual_grant',false,0,false,true,'Kuwait Labour Law Art. 69'),
  ('KW','MATERNITY','Maternity Leave',70,'[{"days":70,"payPct":100}]','Female',0,'annual_grant',false,0,false,true,'Kuwait Labour Law Art. 24'),
  ('IN','EL','Earned Leave',18,NULL,'All',3,'monthly_accrual',true,30,true,false,'Shops & Establishments (state-variable)'),
  ('IN','CL','Casual Leave',12,NULL,'All',0,'annual_grant',false,0,false,false,NULL),
  ('IN','SL','Sick Leave',12,NULL,'All',0,'annual_grant',false,0,false,false,NULL),
  ('IN','MATERNITY','Maternity Leave',182,'[{"days":182,"payPct":100}]','Female',0,'annual_grant',false,0,false,true,'Maternity Benefit Act — 26 weeks'),
  ('GB','ANNUAL','Annual Leave',28,NULL,'All',0,'monthly_accrual',false,0,false,true,'Working Time Regulations — 5.6 weeks incl. bank holidays'),
  ('GB','SICK_SSP','Sick Leave (SSP)',28,NULL,'All',0,'annual_grant',false,0,false,true,'SSP weekly rate applies from day 4'),
  ('GB','MATERNITY','Maternity Leave',365,'[{"days":42,"payPct":90}]','Female',6,'annual_grant',false,0,false,true,'SMP: 90% for 6 weeks then statutory rate 33 weeks'),
  ('GB','PATERNITY','Paternity Leave',14,NULL,'All',6,'annual_grant',false,0,false,true,'Statutory Paternity Pay'),
  ('US','PTO','Paid Time Off',15,NULL,'All',0,'per_hours_worked',true,5,true,false,'Company policy — no federal statutory minimum'),
  ('US','SICK','Sick Leave',5,NULL,'All',0,'annual_grant',false,0,false,false,'State/city mandates vary'),
  ('US','FMLA','FMLA (Unpaid)',84,'[{"days":84,"payPct":0}]','All',12,'annual_grant',false,0,false,true,'FMLA — 12 weeks unpaid, job-protected')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Holiday calendars (2026 national seeds; lunar dates tentative)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS holiday_calendars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  jurisdiction  text,      -- state/emirate for regional holidays
  year          integer NOT NULL,
  name          text NOT NULL,
  holiday_type  text NOT NULL DEFAULT 'public'
                  CHECK (holiday_type IN ('public','religious','national','bank','company','optional')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  is_tentative  boolean NOT NULL DEFAULT false,
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, jurisdiction, year, name)
);
CREATE INDEX IF NOT EXISTS idx_holidays_lookup ON holiday_calendars(country_code, year, jurisdiction);

ALTER TABLE holiday_calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hc_read ON holiday_calendars;
CREATE POLICY hc_read ON holiday_calendars FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS hc_company_write ON holiday_calendars;
CREATE POLICY hc_company_write ON holiday_calendars FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS hc_platform_write ON holiday_calendars;
CREATE POLICY hc_platform_write ON holiday_calendars FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO holiday_calendars (country_code, year, name, holiday_type, start_date, end_date, is_tentative) VALUES
  ('BH',2026,'New Year''s Day','public','2026-01-01','2026-01-01',false),
  ('BH',2026,'Eid Al Fitr','religious','2026-03-20','2026-03-22',true),
  ('BH',2026,'Labour Day','public','2026-05-01','2026-05-01',false),
  ('BH',2026,'Eid Al Adha','religious','2026-05-27','2026-05-29',true),
  ('BH',2026,'Islamic New Year','religious','2026-06-17','2026-06-17',true),
  ('BH',2026,'Ashoora','religious','2026-06-25','2026-06-26',true),
  ('BH',2026,'Prophet''s Birthday','religious','2026-08-25','2026-08-25',true),
  ('BH',2026,'National Day','national','2026-12-16','2026-12-17',false),
  ('AE',2026,'New Year''s Day','public','2026-01-01','2026-01-01',false),
  ('AE',2026,'Eid Al Fitr','religious','2026-03-20','2026-03-23',true),
  ('AE',2026,'Arafat Day & Eid Al Adha','religious','2026-05-26','2026-05-29',true),
  ('AE',2026,'Islamic New Year','religious','2026-06-17','2026-06-17',true),
  ('AE',2026,'Prophet''s Birthday','religious','2026-08-25','2026-08-25',true),
  ('AE',2026,'Commemoration Day & National Day','national','2026-12-01','2026-12-03',false),
  ('SA',2026,'Founding Day','national','2026-02-22','2026-02-22',false),
  ('SA',2026,'Eid Al Fitr','religious','2026-03-19','2026-03-23',true),
  ('SA',2026,'Arafat Day & Eid Al Adha','religious','2026-05-26','2026-05-30',true),
  ('SA',2026,'National Day','national','2026-09-23','2026-09-23',false),
  ('OM',2026,'New Year''s Day','public','2026-01-01','2026-01-01',false),
  ('OM',2026,'Eid Al Fitr','religious','2026-03-20','2026-03-23',true),
  ('OM',2026,'Eid Al Adha','religious','2026-05-26','2026-05-29',true),
  ('OM',2026,'National Day','national','2026-11-18','2026-11-19',false),
  ('QA',2026,'Eid Al Fitr','religious','2026-03-20','2026-03-22',true),
  ('QA',2026,'Eid Al Adha','religious','2026-05-27','2026-05-29',true),
  ('QA',2026,'National Day','national','2026-12-18','2026-12-18',false),
  ('KW',2026,'New Year''s Day','public','2026-01-01','2026-01-01',false),
  ('KW',2026,'National Day','national','2026-02-25','2026-02-25',false),
  ('KW',2026,'Liberation Day','national','2026-02-26','2026-02-26',false),
  ('KW',2026,'Eid Al Fitr','religious','2026-03-20','2026-03-22',true),
  ('KW',2026,'Eid Al Adha','religious','2026-05-27','2026-05-29',true),
  ('IN',2026,'Republic Day','national','2026-01-26','2026-01-26',false),
  ('IN',2026,'Holi','religious','2026-03-03','2026-03-03',true),
  ('IN',2026,'Independence Day','national','2026-08-15','2026-08-15',false),
  ('IN',2026,'Gandhi Jayanti','national','2026-10-02','2026-10-02',false),
  ('IN',2026,'Diwali','religious','2026-11-08','2026-11-08',true),
  ('GB',2026,'New Year''s Day','bank','2026-01-01','2026-01-01',false),
  ('GB',2026,'Good Friday','bank','2026-04-03','2026-04-03',false),
  ('GB',2026,'Easter Monday','bank','2026-04-06','2026-04-06',false),
  ('GB',2026,'Early May Bank Holiday','bank','2026-05-04','2026-05-04',false),
  ('GB',2026,'Spring Bank Holiday','bank','2026-05-25','2026-05-25',false),
  ('GB',2026,'Summer Bank Holiday','bank','2026-08-31','2026-08-31',false),
  ('GB',2026,'Christmas Day','bank','2026-12-25','2026-12-25',false),
  ('GB',2026,'Boxing Day (substitute)','bank','2026-12-28','2026-12-28',false),
  ('US',2026,'New Year''s Day','public','2026-01-01','2026-01-01',false),
  ('US',2026,'Martin Luther King Jr. Day','public','2026-01-19','2026-01-19',false),
  ('US',2026,'Memorial Day','public','2026-05-25','2026-05-25',false),
  ('US',2026,'Juneteenth','public','2026-06-19','2026-06-19',false),
  ('US',2026,'Independence Day (observed)','public','2026-07-03','2026-07-03',false),
  ('US',2026,'Labor Day','public','2026-09-07','2026-09-07',false),
  ('US',2026,'Thanksgiving','public','2026-11-26','2026-11-26',false),
  ('US',2026,'Christmas Day','public','2026-12-25','2026-12-25',false)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Overtime rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS overtime_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code    char(2) NOT NULL REFERENCES countries(code),
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,
  rule_code       text NOT NULL,      -- 'NORMAL_OT','HOLIDAY_OT','NIGHT_OT','US_FLSA_WEEKLY'
  rule_name       text NOT NULL,
  multiplier      numeric(4,2) NOT NULL,
  basis           text NOT NULL DEFAULT 'hourly_from_monthly'
                    CHECK (basis IN ('hourly_from_monthly','hourly_rate','daily_rate','weekly_threshold')),
  threshold_hours numeric(6,2),       -- e.g. 40 for US weekly OT
  ramadan_hours   numeric(4,2),       -- GCC reduced daily hours in Ramadan
  effective_from  date NOT NULL DEFAULT '2020-01-01',
  effective_to    date,
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, rule_code, effective_from)
);

ALTER TABLE overtime_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS otr_read ON overtime_rules;
CREATE POLICY otr_read ON overtime_rules FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS otr_company_write ON overtime_rules;
CREATE POLICY otr_company_write ON overtime_rules FOR ALL TO authenticated
  USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS otr_platform_write ON overtime_rules;
CREATE POLICY otr_platform_write ON overtime_rules FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO overtime_rules (country_code, rule_code, rule_name, multiplier, basis, threshold_hours, ramadan_hours) VALUES
  ('BH','NORMAL_OT','Normal Overtime',1.25,'hourly_from_monthly',NULL,6),
  ('BH','HOLIDAY_OT','Holiday / Rest-day Overtime',1.50,'hourly_from_monthly',NULL,6),
  ('AE','NORMAL_OT','Normal Overtime',1.25,'hourly_from_monthly',NULL,6),
  ('AE','NIGHT_OT','Night Overtime (21:00–04:00)',1.50,'hourly_from_monthly',NULL,6),
  ('AE','HOLIDAY_OT','Rest-day Overtime',1.50,'hourly_from_monthly',NULL,6),
  ('SA','NORMAL_OT','Overtime',1.50,'hourly_from_monthly',NULL,6),
  ('OM','NORMAL_OT','Normal Overtime',1.25,'hourly_from_monthly',NULL,6),
  ('OM','NIGHT_OT','Night Overtime',1.50,'hourly_from_monthly',NULL,6),
  ('QA','NORMAL_OT','Normal Overtime',1.25,'hourly_from_monthly',NULL,6),
  ('QA','NIGHT_OT','Night Overtime (21:00–06:00)',1.50,'hourly_from_monthly',NULL,6),
  ('KW','NORMAL_OT','Normal Overtime',1.25,'hourly_from_monthly',NULL,6),
  ('KW','HOLIDAY_OT','Rest-day Overtime',1.50,'hourly_from_monthly',NULL,6),
  ('IN','NORMAL_OT','Overtime (Factories/S&E Acts)',2.00,'hourly_from_monthly',NULL,NULL),
  ('GB','NORMAL_OT','Overtime (contractual)',1.00,'hourly_rate',NULL,NULL),
  ('US','US_FLSA_WEEKLY','FLSA Weekly Overtime',1.50,'weekly_threshold',40,NULL)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
