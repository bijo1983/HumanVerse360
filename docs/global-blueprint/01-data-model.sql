-- ============================================================================
-- HumanVerse360 Multi-Country Platform — Proposed Database Schema (Postgres)
-- ============================================================================
-- Conventions
--   * Platform-global configuration rows have company_id IS NULL (the "country
--     template"). A company-specific override is a row with company_id set;
--     the resolver prefers the override.
--   * Every effective-dated table is queried with:
--       effective_from <= :period_end AND (effective_to IS NULL OR effective_to >= :period_start)
--   * RLS: platform-global rows are readable by all authenticated users and
--     writable only by platform admins (is_platform_admin()); company rows use
--     the existing company_id = get_current_company_id() pattern.
--   * All monetary values: numeric(14,4) internally; presentation rounding is
--     driven by countries.currency_decimals (BHD/KWD/OMR = 3, most = 2).
-- ============================================================================

-- ============================================================
-- 1. COUNTRY MASTER
-- ============================================================

CREATE TABLE countries (
  code               char(2) PRIMARY KEY,            -- ISO 3166-1 alpha-2: 'BH','AE','SA','OM','QA','KW','IN','GB','US'
  name               text NOT NULL,                  -- 'Bahrain'
  native_name        text,                           -- 'البحرين'
  currency_code      char(3) NOT NULL,               -- ISO 4217: 'BHD'
  currency_symbol    text NOT NULL,                  -- 'BD'
  currency_decimals  smallint NOT NULL DEFAULT 2,    -- BHD/KWD/OMR=3, else 2
  date_format        text NOT NULL DEFAULT 'DD/MM/YYYY',   -- US: 'MM/DD/YYYY'
  number_locale      text NOT NULL DEFAULT 'en',     -- Intl locale for number formatting; IN uses 'en-IN' (lakh/crore grouping)
  default_timezone   text NOT NULL,                  -- 'Asia/Bahrain'
  dial_code          text,                           -- '+973'
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- The versioned "everything else" bundle for a country. One active version per
-- (country, company-scope). JSONB keeps the shape identical to the importable
-- template files in country-templates/*.json.
CREATE TABLE country_configurations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code              char(2) NOT NULL REFERENCES countries(code),
  company_id                uuid REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = platform template
  version                   integer NOT NULL DEFAULT 1,
  status                    text NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft','pending_approval','active','archived')),
  -- Scalar quick-access config (denormalized from JSONB for query speed)
  national_id_label         text NOT NULL,            -- 'CPR Number' / 'Emirates ID' / 'Aadhaar Number' / 'National Insurance Number' / 'SSN'
  national_id_validation    text,                     -- regex, e.g. '^[0-9]{9}$' for CPR
  tax_id_label              text,                     -- 'PAN' (IN), 'Tax Code' (GB), NULL for GCC
  payroll_frequency         text NOT NULL DEFAULT 'monthly'
                              CHECK (payroll_frequency IN ('monthly','semi_monthly','bi_weekly','weekly')),
  weekend_days              smallint[] NOT NULL DEFAULT '{5,6}',  -- ISO dow: 5=Fri,6=Sat (BH); GB/US/IN = '{6,7}'
  default_working_days      smallint NOT NULL DEFAULT 26,
  daily_hours               numeric(4,2) NOT NULL DEFAULT 8,
  income_tax_applicable     boolean NOT NULL DEFAULT false,
  social_insurance_applicable boolean NOT NULL DEFAULT false,
  eosb_applicable           boolean NOT NULL DEFAULT false,
  gratuity_applicable       boolean NOT NULL DEFAULT false,
  wps_applicable            boolean NOT NULL DEFAULT false,
  -- Full template payload (sections mirror country-templates/*.json)
  config                    jsonb NOT NULL DEFAULT '{}',
  effective_from            date NOT NULL DEFAULT CURRENT_DATE,
  effective_to              date,
  created_by                uuid REFERENCES auth.users(id),
  approved_by               uuid REFERENCES auth.users(id),
  approved_at               timestamptz,
  created_at                timestamptz DEFAULT now(),
  UNIQUE (country_code, company_id, version)
);
CREATE INDEX idx_country_config_lookup
  ON country_configurations (country_code, company_id, status, effective_from);

-- companies: add the linkage (ALTER of existing table)
-- ALTER TABLE companies
--   ADD COLUMN country_code char(2) REFERENCES countries(code),
--   ADD COLUMN currency_code char(3),
--   ADD COLUMN weekend_days_override smallint[],
--   ADD COLUMN active_config_id uuid REFERENCES country_configurations(id);
-- backfill: UPDATE companies SET country_code='BH', currency_code='BHD' WHERE country='Bahrain';

-- ============================================================
-- 2. DYNAMIC EMPLOYEE FIELDS (evolves existing custom_fields)
-- ============================================================

CREATE TABLE country_field_definitions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code         char(2) REFERENCES countries(code),   -- NULL = global field (all countries)
  company_id           uuid REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = country template
  module               text NOT NULL DEFAULT 'employees',    -- 'employees','payroll','leave'
  section_name         text NOT NULL DEFAULT 'Personal',     -- form tab/section
  field_key            text NOT NULL,                        -- 'national_id','gosi_number','uan','tax_code','w4_filing_status'
  field_label          text NOT NULL,
  field_label_i18n     jsonb DEFAULT '{}',                   -- {"ar":"رقم الهوية","hi":"आधार संख्या"}
  field_type           text NOT NULL DEFAULT 'text'
                         CHECK (field_type IN ('text','number','date','select','multiselect',
                                               'checkbox','textarea','masked','file','country','state')),
  options              jsonb,                                -- select choices [{value,label}]
  is_required          boolean NOT NULL DEFAULT false,
  is_visible           boolean NOT NULL DEFAULT true,
  is_sensitive         boolean NOT NULL DEFAULT false,       -- triggers masking + encryption + audit-on-view
  validation_rule      jsonb,                                -- {"regex":"^\\d{9}$","minLength":9,"maxLength":9,"checksum":"aadhaar_verhoeff"}
  placeholder          text,
  help_text            text,
  default_value        text,
  display_order        integer NOT NULL DEFAULT 0,
  dependency_condition jsonb,                                -- {"field":"employment_type","operator":"eq","value":"Contract"}
  is_identity_field    boolean NOT NULL DEFAULT false,       -- exactly one per country: the "national ID"
  maps_to_variable     text,                                 -- exposes value to formula engine, e.g. 'GOSI_NUMBER','TAX_CODE'
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (module, field_key, country_code, company_id)
);

-- Values: EAV row store (authoritative) + JSONB snapshot on employees for reads.
CREATE TABLE employee_field_values (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id          uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  field_definition_id  uuid NOT NULL REFERENCES country_field_definitions(id) ON DELETE CASCADE,
  value                text,                 -- plaintext for non-sensitive fields
  value_encrypted      bytea,                -- pgsodium/pgcrypto ciphertext when is_sensitive
  updated_by           uuid REFERENCES auth.users(id),
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (employee_id, field_definition_id)
);
CREATE INDEX idx_efv_employee ON employee_field_values(employee_id);

-- employees: ALTERs for the new world
-- ALTER TABLE employees
--   ADD COLUMN country_code char(2) REFERENCES countries(code),  -- defaults from company
--   ADD COLUMN dynamic_fields jsonb NOT NULL DEFAULT '{}',       -- trigger-maintained snapshot {field_key: value} (non-sensitive only)
--   ADD COLUMN national_id_search text GENERATED ALWAYS AS (dynamic_fields->>'national_id') STORED;
-- CREATE INDEX idx_employees_national_id ON employees(national_id_search);
-- CREATE INDEX idx_employees_dynamic_fields ON employees USING gin(dynamic_fields);

-- ============================================================
-- 3. ADDRESS FORMATS
-- ============================================================

CREATE TABLE country_address_formats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  company_id     uuid REFERENCES companies(id) ON DELETE CASCADE,
  -- ordered field list; each: {key,label,type,required,options_source,display_order,width}
  -- BH: block, road, building, flat, governorate(select)
  -- US: address_line1, address_line2, city, state(select:us_states), zip(regex), county
  fields         jsonb NOT NULL,
  display_template text,     -- '{{building}}, Road {{road}}, Block {{block}}, {{governorate}}' for one-line rendering
  is_active      boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id)
);

CREATE TABLE employee_addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  address_type  text NOT NULL DEFAULT 'current' CHECK (address_type IN ('current','permanent','home_country')),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  address_data  jsonb NOT NULL DEFAULT '{}',   -- keys match the country's address format fields
  UNIQUE (employee_id, address_type)
);

-- ============================================================
-- 4. DOCUMENT REQUIREMENTS
-- ============================================================

CREATE TABLE country_document_requirements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code       char(2) NOT NULL REFERENCES countries(code),
  company_id         uuid REFERENCES companies(id) ON DELETE CASCADE,
  document_code      text NOT NULL,            -- 'cpr_copy','i9_form','p45','pf_declaration'
  document_name      text NOT NULL,
  is_mandatory       boolean NOT NULL DEFAULT false,
  requires_upload    boolean NOT NULL DEFAULT true,
  has_number         boolean NOT NULL DEFAULT false,
  has_expiry         boolean NOT NULL DEFAULT false,
  expiry_notify_days integer[] DEFAULT '{90,60,30}',   -- notification ladder
  applicable_when    jsonb,                    -- {"nationality":"expat"} / {"employment_type":["Full-Time"]}
  display_order      integer DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id, document_code)
);

-- employee_documents (existing): DROP the CHECK constraint on document_type;
-- ADD COLUMN requirement_id uuid REFERENCES country_document_requirements(id);
-- keep document_type text for free-form "Other" documents.

-- ============================================================
-- 5. PAYROLL COMPONENTS, STRUCTURES, ASSIGNMENTS
-- ============================================================

CREATE TABLE payroll_components (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code             char(2) REFERENCES countries(code),   -- NULL = global (e.g. 'Loan')
  company_id               uuid REFERENCES companies(id) ON DELETE CASCADE,
  component_code           text NOT NULL,       -- 'BASIC','HRA','GOSI_EE','PF_EE','PAYE','FED_TAX','EOSB_PROV'
  component_name           text NOT NULL,
  component_name_i18n      jsonb DEFAULT '{}',
  component_type           text NOT NULL
                             CHECK (component_type IN ('earning','deduction','employer_contribution','provision')),
  calculation_type         text NOT NULL DEFAULT 'fixed'
                             CHECK (calculation_type IN ('fixed','percentage','formula','statutory')),
  formula                  text,                -- for calculation_type='formula' (current approved expression; history in formula_versions)
  statutory_function       text,               -- for 'statutory': registry key e.g. 'CALCULATE_GOSI','CALCULATE_PAYE'
  percentage_of            text,               -- component_code base for 'percentage'
  default_value            numeric(14,4) DEFAULT 0,
  is_taxable               boolean NOT NULL DEFAULT true,   -- included in taxable base
  is_statutory             boolean NOT NULL DEFAULT false,
  is_recurring             boolean NOT NULL DEFAULT true,
  is_prorated              boolean NOT NULL DEFAULT true,   -- prorate on paid days
  include_in_social_base   boolean NOT NULL DEFAULT false,  -- GOSI/PASI/PF wage base membership
  include_in_eosb_base     boolean NOT NULL DEFAULT false,  -- gratuity/EOSB base membership
  calculation_order        integer NOT NULL DEFAULT 100,    -- topological hint; engine also builds dependency graph
  rounding_rule            text NOT NULL DEFAULT 'half_up'
                             CHECK (rounding_rule IN ('half_up','half_down','ceil','floor','none')),
  rounding_precision       smallint,            -- NULL = currency_decimals
  applicable_employee_types text[],             -- NULL = all
  applicable_nationality   text,                -- 'citizen' | 'expat' | NULL(all) — resolved vs country
  statutory_module_code    text,                -- FK-ish to statutory_modules.module_code
  gl_account_code          text,
  effective_from           date NOT NULL DEFAULT CURRENT_DATE,
  effective_to             date,
  is_active                boolean NOT NULL DEFAULT true,
  display_order            integer DEFAULT 0,
  created_at               timestamptz DEFAULT now(),
  UNIQUE (component_code, country_code, company_id, effective_from)
);
CREATE INDEX idx_pc_country ON payroll_components(country_code, company_id, is_active);

CREATE TABLE payroll_structures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code   char(2) NOT NULL REFERENCES countries(code),
  name           text NOT NULL,                -- 'BH Staff Grade 1-3', 'India Corporate'
  description    text,
  is_default     boolean NOT NULL DEFAULT false,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE payroll_structure_components (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  structure_id   uuid NOT NULL REFERENCES payroll_structures(id) ON DELETE CASCADE,
  component_id   uuid NOT NULL REFERENCES payroll_components(id),
  default_value  numeric(14,4),
  is_overridable boolean NOT NULL DEFAULT true,   -- can per-employee assignment change the value?
  UNIQUE (structure_id, component_id)
);

CREATE TABLE employee_payroll_assignments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id    uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  structure_id   uuid NOT NULL REFERENCES payroll_structures(id),
  component_id   uuid NOT NULL REFERENCES payroll_components(id),
  value          numeric(14,4),          -- employee-specific amount (e.g. BASIC=800)
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to   date,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (employee_id, component_id, effective_from)
);
CREATE INDEX idx_epa_employee ON employee_payroll_assignments(employee_id, effective_from);

-- ============================================================
-- 6. FORMULA VERSIONING (maker-checker)
-- ============================================================

CREATE TABLE formula_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id       uuid NOT NULL REFERENCES payroll_components(id) ON DELETE CASCADE,
  country_code       char(2) REFERENCES countries(code),
  company_id         uuid REFERENCES companies(id) ON DELETE CASCADE,
  version_number     integer NOT NULL,
  formula_expression text NOT NULL,
  variables_used     text[],                    -- extracted at save time for impact analysis
  effective_from     date NOT NULL,
  effective_to       date,
  approval_status    text NOT NULL DEFAULT 'draft'
                       CHECK (approval_status IN ('draft','pending_approval','approved','rejected','superseded')),
  change_reason      text NOT NULL,
  created_by         uuid NOT NULL REFERENCES auth.users(id),
  approved_by        uuid REFERENCES auth.users(id),     -- must differ from created_by (enforced by trigger)
  approved_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (component_id, version_number)
);
CREATE INDEX idx_fv_active ON formula_versions(component_id, approval_status, effective_from);

-- ============================================================
-- 7. STATUTORY MODULES & RULES
-- ============================================================

CREATE TABLE statutory_modules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  module_code   text NOT NULL,     -- 'GOSI','LMRA','WPS','MOHRE','PASI','QID','PF','ESI','PT','TDS','PAYE','NI','PENSION_AE_UK','FICA','FUTA','SUTA','W4','I9','QIWA','MUDAD'
  module_name   text NOT NULL,
  category      text NOT NULL CHECK (category IN ('social_insurance','tax','labour','identity','wage_protection','pension','benefits')),
  is_enabled_by_default boolean NOT NULL DEFAULT true,
  employee_fields text[],           -- field_keys this module needs on the employee (drives conditional tabs)
  description   text,
  UNIQUE (country_code, module_code)
);

-- which modules a company actually enabled
CREATE TABLE company_statutory_modules (
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id    uuid NOT NULL REFERENCES statutory_modules(id) ON DELETE CASCADE,
  is_enabled   boolean NOT NULL DEFAULT true,
  settings     jsonb DEFAULT '{}',   -- module-level settings (e.g. WPS employer bank routing code)
  PRIMARY KEY (company_id, module_id)
);

-- effective-dated rates/thresholds consumed by statutory calculator functions
CREATE TABLE country_statutory_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  module_code    text NOT NULL,
  rule_key       text NOT NULL,        -- 'gosi_citizen_employee_pct','gosi_wage_ceiling','pf_wage_cap','ni_primary_threshold','ss_wage_base_limit'
  rule_value     jsonb NOT NULL,       -- scalar or structure: 0.07 | {"monthly":15000} | [{"upTo":12570,"rate":0}...]
  applicable_to  text,                 -- 'citizen'|'expat'|'gcc_national'|NULL
  effective_from date NOT NULL,
  effective_to   date,
  source_ref     text,                 -- legal citation, e.g. 'BH SIO Circular 2024/01'
  created_at     timestamptz DEFAULT now(),
  UNIQUE (country_code, module_code, rule_key, applicable_to, effective_from)
);

-- ============================================================
-- 8. TAX ENGINE
-- ============================================================

CREATE TABLE tax_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code   char(2) NOT NULL REFERENCES countries(code),
  tax_code       text NOT NULL,        -- 'IN_TDS','GB_PAYE','GB_NI_EE','US_FED','US_STATE','US_SS','US_MEDICARE'
  tax_name       text NOT NULL,
  tax_year       text NOT NULL,        -- 'FY2026-27' (IN), '2026/27' (GB), '2026' (US)
  regime         text,                 -- 'old'|'new' (IN); filing status (US: 'single','married_joint'); NULL otherwise
  jurisdiction   text,                 -- US state code / IN professional-tax state; NULL = national
  calculation_method text NOT NULL DEFAULT 'slab'
                     CHECK (calculation_method IN ('slab','flat_rate','formula','external')),
  flat_rate      numeric(8,5),
  formula        text,
  annualization  text NOT NULL DEFAULT 'annualize_ytd'
                   CHECK (annualization IN ('annualize_ytd','period_table','cumulative')),  -- GB PAYE is cumulative
  rounding_rule  text DEFAULT 'half_up',
  effective_from date NOT NULL,
  effective_to   date,
  is_active      boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, tax_code, tax_year, regime, jurisdiction)
);

CREATE TABLE tax_slabs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_rule_id   uuid NOT NULL REFERENCES tax_rules(id) ON DELETE CASCADE,
  slab_order    smallint NOT NULL,
  income_from   numeric(14,2) NOT NULL,
  income_to     numeric(14,2),         -- NULL = no upper bound
  rate_pct      numeric(8,5) NOT NULL,
  fixed_amount  numeric(14,2) DEFAULT 0,   -- cumulative tax below this slab (speeds calc)
  UNIQUE (tax_rule_id, slab_order)
);

-- per-employee tax profile (regime election, W-4, UK tax code, PT state…)
CREATE TABLE employee_tax_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  country_code  char(2) NOT NULL REFERENCES countries(code),
  tax_year      text NOT NULL,
  profile       jsonb NOT NULL DEFAULT '{}',
  -- IN: {"regime":"new","pan":"...","declarations":{"80C":150000,...}}
  -- GB: {"tax_code":"1257L","ni_category":"A","student_loan_plan":"plan2","pension_pct":5}
  -- US: {"filing_status":"single","w4_step2":false,"dependents_amount":2000,"extra_withholding":0,"state":"CA"}
  UNIQUE (employee_id, tax_year)
);

-- ============================================================
-- 9. EOSB / GRATUITY RULES
-- ============================================================

CREATE TABLE eosb_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code          char(2) NOT NULL REFERENCES countries(code),
  company_id            uuid REFERENCES companies(id) ON DELETE CASCADE,
  rule_code             text NOT NULL,           -- 'BH_EOSB','AE_GRATUITY','SA_EOSB','IN_GRATUITY','US_PTO_PAYOUT'
  rule_name             text NOT NULL,
  eligibility_months    integer NOT NULL DEFAULT 12,
  calculation_base      text NOT NULL DEFAULT 'basic'
                          CHECK (calculation_base IN ('basic','basic_plus_flagged','gross','last_drawn','custom_formula')),
  base_formula          text,                    -- when calculation_base='custom_formula'
  day_divisor           numeric(6,3) NOT NULL DEFAULT 30,   -- BH/AE=30; IN gratuity=26
  accrual_method        text NOT NULL DEFAULT 'monthly_provision'
                          CHECK (accrual_method IN ('monthly_provision','on_settlement_only')),
  -- tier bands: days of pay per year of service, by service range
  -- BH:  [{"fromYears":0,"toYears":3,"daysPerYear":15},{"fromYears":3,"toYears":null,"daysPerYear":30}]
  -- AE:  [{"fromYears":0,"toYears":5,"daysPerYear":21},{"fromYears":5,"toYears":null,"daysPerYear":30}]
  -- SA:  [{"fromYears":0,"toYears":5,"daysPerYear":15},{"fromYears":5,"toYears":null,"daysPerYear":30}]  -- half/full month
  -- IN:  [{"fromYears":0,"toYears":null,"daysPerYear":15}]  with day_divisor=26, cap via max_amount
  tier_bands            jsonb NOT NULL,
  -- multiplier by termination reason & service years
  -- BH resignation: [{"fromYears":0,"toYears":3,"factor":0.3333},{"fromYears":3,"toYears":5,"factor":0.6667},{"fromYears":5,"toYears":null,"factor":1}]
  termination_factors   jsonb NOT NULL DEFAULT '[]',
  nationality_dependency text,                   -- 'expat_only' (BH EOSB when GOSI-covered citizens excluded) | NULL
  contract_type_dependency jsonb,                -- rules per limited/unlimited if applicable
  max_amount            numeric(14,2),           -- IN gratuity statutory cap (e.g. 2000000)
  max_years_cap         numeric(5,2),            -- e.g. total benefit ≤ 2 years' pay if configured
  effective_from        date NOT NULL,
  effective_to          date,
  is_active             boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id, rule_code, effective_from)
);

-- ============================================================
-- 10. LEAVE, HOLIDAYS, OVERTIME
-- ============================================================

CREATE TABLE leave_policy_templates (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code         char(2) NOT NULL REFERENCES countries(code),
  company_id           uuid REFERENCES companies(id) ON DELETE CASCADE,
  leave_code           text NOT NULL,          -- 'ANNUAL','SICK','MATERNITY','PATERNITY','HAJJ','PTO','SSP_LINKED'
  leave_name           text NOT NULL,
  days_per_year        numeric(6,2) NOT NULL,
  paid_tiers           jsonb,                  -- BH sick: [{"days":15,"payPct":100},{"days":20,"payPct":50},{"days":20,"payPct":0}]
  gender_specific      text DEFAULT 'All' CHECK (gender_specific IN ('All','Male','Female')),
  eligibility_months   integer DEFAULT 0,
  accrual_method       text NOT NULL DEFAULT 'annual_grant'
                         CHECK (accrual_method IN ('annual_grant','monthly_accrual','per_hours_worked')),
  carry_forward        boolean DEFAULT false,
  max_carry_forward    numeric(6,2) DEFAULT 0,
  carry_forward_expiry_months integer,
  encashment_allowed   boolean DEFAULT false,
  encashment_base      text,                   -- 'basic'|'gross'
  min_service_for_encashment integer,
  counts_weekends      boolean DEFAULT true,   -- calendar-days vs working-days deduction
  is_statutory         boolean DEFAULT false,
  statutory_ref        text,                   -- 'BH Labour Law Art. 58'
  is_active            boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id, leave_code)
);

CREATE TABLE holiday_calendars (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  jurisdiction  text,                 -- state/emirate for IN/US state holidays; NULL = national
  year          integer NOT NULL,
  name          text NOT NULL,        -- 'Eid Al Fitr','Independence Day','Diwali'
  holiday_type  text NOT NULL DEFAULT 'public'
                  CHECK (holiday_type IN ('public','religious','national','bank','company','optional')),
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  is_tentative  boolean DEFAULT false,   -- lunar-calendar holidays (Eid) confirmed later
  UNIQUE (country_code, company_id, jurisdiction, year, name)
);
CREATE INDEX idx_holidays_lookup ON holiday_calendars(country_code, year, jurisdiction);

CREATE TABLE overtime_rules (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code       char(2) NOT NULL REFERENCES countries(code),
  company_id         uuid REFERENCES companies(id) ON DELETE CASCADE,
  rule_code          text NOT NULL,       -- 'NORMAL_OT','HOLIDAY_OT','WEEKEND_OT','NIGHT_OT','US_FLSA_WEEKLY'
  multiplier         numeric(4,2) NOT NULL,    -- BH 1.25 / 1.5; US FLSA 1.5 over 40h/wk
  basis              text NOT NULL DEFAULT 'hourly_from_monthly'
                       CHECK (basis IN ('hourly_from_monthly','hourly_rate','daily_rate','weekly_threshold')),
  threshold_hours    numeric(6,2),        -- e.g. 40 for US weekly OT
  formula            text,                -- optional full override formula
  ramadan_hours      numeric(4,2),        -- GCC: reduced daily hours during Ramadan (e.g. 6)
  applies_to         jsonb,               -- {"employee_types":["Full-Time"],"exempt_flag":false}
  effective_from     date NOT NULL DEFAULT CURRENT_DATE,
  effective_to       date,
  is_active          boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id, rule_code, effective_from)
);

-- attendance policy (grace, late/early deductions, flexi) — company-scoped, country-seeded
CREATE TABLE attendance_policies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  country_code          char(2) NOT NULL REFERENCES countries(code),
  grace_minutes         integer DEFAULT 10,
  late_deduction_rule   jsonb,     -- [{"lateMinutesFrom":30,"deductFractionOfDay":0.25}, ...]
  early_going_rule      jsonb,
  absence_daily_rate    text DEFAULT 'calendar_days' CHECK (absence_daily_rate IN ('calendar_days','working_days','fixed_30')),
  flexi_hours_enabled   boolean DEFAULT false,
  night_shift_window    jsonb,     -- {"from":"22:00","to":"06:00","allowancePct":10}
  is_active             boolean NOT NULL DEFAULT true
);

-- ============================================================
-- 11. PAYSLIP TEMPLATES & REPORT MAPPINGS
-- ============================================================

CREATE TABLE payslip_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  name          text NOT NULL DEFAULT 'Default',
  -- layout: ordered blocks; identity block lists field_keys + masking
  -- {"header":{"showLogo":true},
  --  "identity":[{"fieldKey":"national_id","mask":"last4"},{"fieldKey":"gosi_number"}],
  --  "earnings":{"componentTypes":["earning"]},
  --  "deductions":{"componentTypes":["deduction"]},
  --  "employerBlock":{"visible":false},
  --  "ytdBlock":{"visible":true},           -- GB/US/IN payslips show YTD
  --  "footer":{"labels":{"net":"Net Pay"}}}
  layout        jsonb NOT NULL,
  is_default    boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  UNIQUE (country_code, company_id, name)
);

CREATE TABLE report_field_mappings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  char(2) REFERENCES countries(code),   -- NULL = global default
  company_id    uuid REFERENCES companies(id) ON DELETE CASCADE,
  report_code   text NOT NULL,        -- 'employee_master','payroll_register','statutory_gosi','wps_sif','pf_ecr'
  field_key     text NOT NULL,        -- logical field: 'national_id','social_number','tax_number'
  column_label  text NOT NULL,        -- what the export header shows: 'CPR Number' / 'Emirates ID' / 'SSN'
  source        text NOT NULL,        -- 'employees.first_name' | 'dynamic:national_id' | 'component:GOSI_EE'
  display_order integer DEFAULT 0,
  format        text,                 -- 'currency','date','masked'
  is_visible    boolean DEFAULT true,
  UNIQUE (report_code, field_key, country_code, company_id)
);

-- ============================================================
-- 12. PAYROLL RUNS (extend existing) & AUDIT
-- ============================================================

-- payroll_runs (existing) ALTERs:
--   ADD COLUMN company_id uuid REFERENCES companies(id),
--   ADD COLUMN country_code char(2) REFERENCES countries(code),
--   ADD COLUMN currency_code char(3),
--   ADD COLUMN config_snapshot_id uuid REFERENCES country_configurations(id),
--   ADD COLUMN period_start date, ADD COLUMN period_end date;   -- supports weekly/bi-weekly
--   DROP the UNIQUE(month, year) → UNIQUE(company_id, period_start, period_end)

-- Fully component-based line detail (replaces fixed columns of payroll_line_items)
CREATE TABLE payroll_run_details (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id     uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id        uuid NOT NULL REFERENCES employees(id),
  component_id       uuid NOT NULL REFERENCES payroll_components(id),
  component_code     text NOT NULL,           -- denormalized for reporting stability
  component_type     text NOT NULL,
  formula_version_id uuid REFERENCES formula_versions(id),   -- exactly which formula produced this number
  input_snapshot     jsonb,                   -- variables at calc time (auditable replay)
  amount             numeric(14,4) NOT NULL,
  ytd_amount         numeric(14,4),           -- maintained for GB/US/IN cumulative taxes
  currency_code      char(3) NOT NULL,
  created_at         timestamptz DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id, component_id)
);
CREATE INDEX idx_prd_run_emp ON payroll_run_details(payroll_run_id, employee_id);

CREATE TABLE payroll_employee_summary (
  payroll_run_id   uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id      uuid NOT NULL REFERENCES employees(id),
  working_days     numeric(5,2), paid_days numeric(5,2), absent_days numeric(5,2),
  ot_hours         numeric(7,2),
  gross            numeric(14,4), total_deductions numeric(14,4),
  employer_cost    numeric(14,4), net_pay numeric(14,4),
  payslip_url      text,
  PRIMARY KEY (payroll_run_id, employee_id)
);

CREATE TABLE payroll_audit_logs (
  id           bigserial PRIMARY KEY,
  company_id   uuid NOT NULL,
  actor_id     uuid,                      -- auth.users
  entity_type  text NOT NULL,             -- 'payroll_run','formula_version','country_configuration','statutory_rule','field_definition'
  entity_id    uuid,
  action       text NOT NULL,             -- 'create','update','approve','reject','process','rollback','view_sensitive'
  before_state jsonb,
  after_state  jsonb,
  reason       text,
  ip_address   inet,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_entity ON payroll_audit_logs(entity_type, entity_id, created_at);
CREATE INDEX idx_audit_company_time ON payroll_audit_logs(company_id, created_at);

-- ============================================================
-- 13. RLS PATTERN (apply to every table above)
-- ============================================================
-- Platform-template rows (company_id IS NULL):
--   SELECT: all authenticated;  ALL: is_platform_admin()
-- Company rows:
--   ALL: company_id = get_current_company_id()
-- Example:
-- ALTER TABLE payroll_components ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY pc_read ON payroll_components FOR SELECT TO authenticated
--   USING (company_id IS NULL OR company_id = get_current_company_id());
-- CREATE POLICY pc_write_company ON payroll_components FOR ALL TO authenticated
--   USING (company_id = get_current_company_id())
--   WITH CHECK (company_id = get_current_company_id());
-- CREATE POLICY pc_write_platform ON payroll_components FOR ALL TO authenticated
--   USING (is_platform_admin()) WITH CHECK (is_platform_admin());
