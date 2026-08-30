-- ============================================================
-- 32: Dynamic employee master (Phase 1)
--     custom_fields → full field definitions, country field seeds,
--     country address formats, structured employee addresses,
--     employee UI hints on country configurations
-- ============================================================

-- ------------------------------------------------------------
-- 1. Promote custom_fields to full field definitions
-- ------------------------------------------------------------
ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS validation_rule      jsonb,
  ADD COLUMN IF NOT EXISTS is_visible           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_sensitive         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_value        text,
  ADD COLUMN IF NOT EXISTS dependency_condition jsonb,
  ADD COLUMN IF NOT EXISTS maps_to_variable     text,
  ADD COLUMN IF NOT EXISTS field_label_i18n     jsonb NOT NULL DEFAULT '{}';

-- ------------------------------------------------------------
-- 2. Employee UI hints per country (national ID placeholder/expiry,
--    GCC immigration section visibility)
-- ------------------------------------------------------------
UPDATE country_configurations SET config = config || jsonb_build_object('employee_ui', ui.hints)
FROM (VALUES
  ('BH', '{"national_id_placeholder":"880112345","national_id_expiry_label":"CPR Expiry","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('AE', '{"national_id_placeholder":"784-xxxx-xxxxxxx-x","national_id_expiry_label":"Emirates ID Expiry","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('SA', '{"national_id_placeholder":"2xxxxxxxxx","national_id_expiry_label":"Iqama Expiry Date","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('OM', '{"national_id_placeholder":"","national_id_expiry_label":"Civil ID Expiry","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('QA', '{"national_id_placeholder":"28xxxxxxxxx","national_id_expiry_label":"QID Expiry","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('KW', '{"national_id_placeholder":"2xxxxxxxxxx","national_id_expiry_label":"Civil ID Expiry","national_id_required":true,"national_id_has_expiry":true,"show_immigration":true}'::jsonb),
  ('IN', '{"national_id_placeholder":"12-digit Aadhaar","national_id_required":true,"national_id_has_expiry":false,"show_immigration":false}'::jsonb),
  ('GB', '{"national_id_placeholder":"QQ123456C","national_id_required":true,"national_id_has_expiry":false,"show_immigration":false}'::jsonb),
  ('US', '{"national_id_placeholder":"XXX-XX-XXXX","national_id_required":true,"national_id_has_expiry":false,"show_immigration":false}'::jsonb)
) AS ui(code, hints)
WHERE country_configurations.country_code = ui.code
  AND country_configurations.company_id IS NULL;

-- ------------------------------------------------------------
-- 3. Country-specific employee field seeds (platform level)
--    National IDs + their expiries stay on employees.cpr_number /
--    cpr_expiry (see migration 19) — NOT re-seeded here.
--    Idempotent: NOT EXISTS guard (unique constraint treats NULL
--    company_id as distinct, so ON CONFLICT alone is not enough).
-- ------------------------------------------------------------
INSERT INTO custom_fields
  (module, section, field_key, field_label, field_type, options, is_required,
   placeholder, hint, sort_order, country_code, validation_rule, is_sensitive,
   default_value, dependency_condition, maps_to_variable)
SELECT v.module, v.section, v.field_key, v.field_label, v.field_type,
       v.options::jsonb, v.is_required, v.placeholder, v.hint, v.sort_order,
       v.country_code, v.validation_rule::jsonb, v.is_sensitive, v.default_value,
       v.dependency_condition::jsonb, v.maps_to_variable
FROM (VALUES
-- ===== Bahrain =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["Bahraini","Expatriate"]',false,NULL,'Drives GOSI and EOSB applicability',1,'BH',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),
-- (gosi_number / lmra_id seeded in migration 09)

-- ===== UAE =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["UAE National","GCC National","Expatriate"]',false,NULL,'Drives GPSSA pension and gratuity applicability',1,'AE',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),
  ('employees','Statutory','labour_card_number','Labour Card Number','text',NULL,false,NULL,NULL,10,'AE',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','mohre_number','MOHRE Number','text',NULL,false,NULL,'Ministry of Human Resources & Emiratisation',11,'AE',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','wps_person_id','WPS Person ID','text',NULL,false,NULL,'14-digit MOHRE person ID used in the SIF file',12,'AE','{"regex":"^[0-9]{14}$"}',false,NULL,NULL,NULL),
  ('employees','Statutory','contract_type','Contract Type','select','["Limited","Unlimited"]',false,NULL,NULL,13,'AE',NULL,false,'Limited',NULL,'CONTRACT_TYPE'),

-- ===== Saudi Arabia =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["Saudi","Expatriate"]',false,NULL,'Drives GOSI rates and EOSB applicability',1,'SA',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),
  ('employees','Statutory','qiwa_contract_id','Qiwa Contract ID','text',NULL,false,NULL,'Qiwa platform employment contract reference',10,'SA',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','mudad_ref','Mudad Reference','text',NULL,false,NULL,'Mudad payroll platform reference',11,'SA',NULL,false,NULL,NULL,NULL),

-- ===== Oman =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["Omani","Expatriate"]',false,NULL,'Drives PASI and EOSB applicability',1,'OM',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),
  ('employees','Statutory','pasi_number','PASI Number','text',NULL,false,NULL,'Public Authority for Social Insurance',10,'OM',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','labour_card_number','Labour Card Number','text',NULL,false,NULL,NULL,11,'OM',NULL,false,NULL,NULL,NULL),

-- ===== Qatar =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["Qatari","Expatriate"]',false,NULL,'Drives pension and EOSB applicability',1,'QA',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),

-- ===== Kuwait =====
  ('employees','Statutory','nationality_class','Nationality Class','select','["Kuwaiti","Expatriate"]',false,NULL,'Drives PIFSS and indemnity applicability',1,'KW',NULL,false,'Expatriate',NULL,'NATIONALITY_CLASS'),
  ('employees','Statutory','pifss_number','PIFSS Number','text',NULL,false,NULL,'Public Institution for Social Security',10,'KW',NULL,false,NULL,NULL,NULL),

-- ===== India =====
  ('employees','Statutory','pan_number','PAN Number','text',NULL,true,'ABCDE1234F','Permanent Account Number (income tax)',10,'IN','{"regex":"^[A-Z]{5}[0-9]{4}[A-Z]$"}',true,NULL,NULL,'PAN'),
  ('employees','Statutory','uan','UAN','text',NULL,false,'12-digit UAN','Universal Account Number (EPFO)',11,'IN','{"regex":"^[0-9]{12}$"}',false,NULL,NULL,NULL),
  ('employees','Statutory','pf_number','PF Number','text',NULL,false,NULL,'Provident Fund account number',12,'IN',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','esi_number','ESI Number','text',NULL,false,NULL,'Employees'' State Insurance number',13,'IN','{"regex":"^[0-9]{10,17}$"}',false,NULL,NULL,NULL),
  ('employees','Statutory','pt_state','Professional Tax State','select','["Andhra Pradesh","Assam","Bihar","Chhattisgarh","Gujarat","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Meghalaya","Odisha","Punjab","Sikkim","Tamil Nadu","Telangana","Tripura","West Bengal","Not Applicable"]',false,NULL,'State whose professional tax slabs apply',14,'IN',NULL,false,NULL,NULL,'PT_STATE'),
  ('employees','Statutory','tax_regime','Income Tax Regime','select','["New Regime","Old Regime"]',false,NULL,'Employee''s elected income tax regime',15,'IN',NULL,false,'New Regime',NULL,'TAX_REGIME'),
  ('employees','Statutory','bank_ifsc','Bank IFSC Code','text',NULL,false,'HDFC0001234','Required for salary bank transfers',20,'IN','{"regex":"^[A-Z]{4}0[A-Z0-9]{6}$"}',false,NULL,NULL,NULL),

-- ===== United Kingdom =====
  ('employees','Statutory','tax_code','Tax Code','text',NULL,true,'1257L','HMRC tax code from P45/Starter Checklist',10,'GB','{"regex":"^([1-9][0-9]{0,3}[LMNPTY]|BR|D0|D1|NT|0T|K[0-9]{1,4})(W1|M1|X)?$"}',false,'1257L',NULL,'TAX_CODE'),
  ('employees','Statutory','ni_category','NI Category Letter','select','["A","B","C","H"]',false,NULL,'National Insurance category letter',11,'GB',NULL,false,'A',NULL,'NI_CATEGORY'),
  ('employees','Statutory','paye_reference','PAYE Reference','text',NULL,false,NULL,NULL,12,'GB',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','pension_scheme_number','Pension Scheme Number','text',NULL,false,NULL,'Auto-enrolment pension scheme membership',13,'GB',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','pension_pct','Pension Contribution %','number',NULL,false,'5',NULL,14,'GB','{"min":0,"max":100}',false,'5',NULL,'PENSION_PCT'),
  ('employees','Statutory','student_loan_plan','Student Loan Plan','select','["None","Plan 1","Plan 2","Plan 4","Postgraduate"]',false,NULL,NULL,15,'GB',NULL,false,'None',NULL,'STUDENT_LOAN_PLAN'),
  ('employees','Statutory','right_to_work_status','Right to Work Status','select','["British/Irish Citizen","Settled Status","Pre-Settled Status","Work Visa"]',true,NULL,NULL,20,'GB',NULL,false,NULL,NULL,NULL),
  ('employees','Statutory','rtw_expiry','Right to Work Expiry','date',NULL,false,NULL,'Required for time-limited right to work',21,'GB',NULL,false,NULL,'{"field":"right_to_work_status","operator":"in","value":["Pre-Settled Status","Work Visa"]}',NULL),

-- ===== United States =====
  ('employees','Statutory','w4_filing_status','Federal Filing Status (W-4)','select','["Single or Married filing separately","Married filing jointly","Head of household"]',true,NULL,'From the employee''s Form W-4 Step 1(c)',10,'US',NULL,false,NULL,NULL,'W4_FILING_STATUS'),
  ('employees','Statutory','w4_multiple_jobs','W-4 Step 2: Multiple Jobs','checkbox',NULL,false,NULL,'Box checked on Form W-4 Step 2',11,'US',NULL,false,'false',NULL,'W4_STEP2'),
  ('employees','Statutory','w4_dependents_amount','W-4 Step 3: Dependents Credit ($)','number',NULL,false,'0',NULL,12,'US','{"min":0}',false,'0',NULL,'W4_DEPENDENTS'),
  ('employees','Statutory','w4_extra_withholding','W-4 Step 4c: Extra Withholding ($)','number',NULL,false,'0',NULL,13,'US','{"min":0}',false,'0',NULL,'W4_EXTRA_WH'),
  ('employees','Statutory','state_tax_state','State Tax Jurisdiction','select','["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]',true,NULL,'State whose withholding rules apply',14,'US',NULL,false,NULL,NULL,'TAX_STATE'),
  ('employees','Statutory','flsa_status','FLSA Status','select','["Non-Exempt","Exempt"]',false,NULL,'Non-exempt employees are overtime-eligible',15,'US',NULL,false,'Non-Exempt',NULL,'FLSA_STATUS'),
  ('employees','Statutory','i9_verified','I-9 Verified','checkbox',NULL,false,NULL,'Form I-9 employment eligibility verified',16,'US',NULL,false,'false',NULL,NULL),
  ('employees','Statutory','plan_401k_pct','401(k) Contribution %','number',NULL,false,'0',NULL,20,'US','{"min":0,"max":100}',false,'0',NULL,'K401_PCT'),
  ('employees','Statutory','plan_401k_match_pct','401(k) Employer Match %','number',NULL,false,'0',NULL,21,'US','{"min":0,"max":100}',false,'0',NULL,'K401_MATCH_PCT')
) AS v(module, section, field_key, field_label, field_type, options, is_required,
       placeholder, hint, sort_order, country_code, validation_rule, is_sensitive,
       default_value, dependency_condition, maps_to_variable)
WHERE NOT EXISTS (
  SELECT 1 FROM custom_fields cf
  WHERE cf.module = v.module
    AND cf.field_key = v.field_key
    AND cf.country_code = v.country_code
    AND cf.company_id IS NULL
);

-- ------------------------------------------------------------
-- 4. Country address formats
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country_address_formats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code     char(2) NOT NULL REFERENCES countries(code),
  company_id       uuid REFERENCES companies(id) ON DELETE CASCADE,
  fields           jsonb NOT NULL,   -- ordered [{key,label,type,required,options,validation,display_order,width}]
  display_template text,             -- one-line rendering, '{{key}}' placeholders
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (country_code, company_id)
);

ALTER TABLE country_address_formats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS caf_read ON country_address_formats;
CREATE POLICY caf_read ON country_address_formats FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS caf_company_write ON country_address_formats;
CREATE POLICY caf_company_write ON country_address_formats FOR ALL TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS caf_platform_write ON country_address_formats;
CREATE POLICY caf_platform_write ON country_address_formats FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO country_address_formats (country_code, fields, display_template)
VALUES
  ('BH',
   '[{"key":"flat","label":"Flat","display_order":1},
     {"key":"building","label":"Building","required":true,"display_order":2},
     {"key":"road","label":"Road","display_order":3},
     {"key":"block","label":"Block","required":true,"validation":{"regex":"^[0-9]{3,4}$"},"display_order":4},
     {"key":"governorate","label":"Governorate","type":"select","options":["Capital","Muharraq","Northern","Southern"],"display_order":5}]',
   'Flat {{flat}}, Bldg {{building}}, Road {{road}}, Block {{block}}, {{governorate}}'),
  ('AE',
   '[{"key":"emirate","label":"Emirate","type":"select","required":true,"options":["Abu Dhabi","Dubai","Sharjah","Ajman","Umm Al Quwain","Ras Al Khaimah","Fujairah"],"display_order":1},
     {"key":"area","label":"Area","display_order":2},
     {"key":"street","label":"Street","display_order":3},
     {"key":"building","label":"Building","display_order":4},
     {"key":"po_box","label":"PO Box","display_order":5}]',
   '{{building}}, {{street}}, {{area}}, {{emirate}}, PO Box {{po_box}}'),
  ('SA',
   '[{"key":"region","label":"Region","display_order":1},
     {"key":"city","label":"City","required":true,"display_order":2},
     {"key":"district","label":"District","display_order":3},
     {"key":"street","label":"Street","display_order":4},
     {"key":"building_number","label":"Building Number","validation":{"regex":"^[0-9]{4}$"},"display_order":5},
     {"key":"postal_code","label":"Postal Code","validation":{"regex":"^[0-9]{5}$"},"display_order":6}]',
   '{{building_number}} {{street}}, {{district}}, {{city}} {{postal_code}}, {{region}}'),
  ('OM',
   '[{"key":"governorate","label":"Governorate","display_order":1},
     {"key":"wilayat","label":"Wilayat","display_order":2},
     {"key":"way","label":"Way","display_order":3},
     {"key":"building","label":"Building","display_order":4},
     {"key":"postal_code","label":"Postal Code","validation":{"regex":"^[0-9]{3}$"},"display_order":5}]',
   'Bldg {{building}}, Way {{way}}, {{wilayat}}, {{governorate}} {{postal_code}}'),
  ('QA',
   '[{"key":"zone","label":"Zone","display_order":1},
     {"key":"street","label":"Street","display_order":2},
     {"key":"building","label":"Building","display_order":3},
     {"key":"unit","label":"Unit","display_order":4},
     {"key":"po_box","label":"PO Box","display_order":5}]',
   'Bldg {{building}}, Street {{street}}, Zone {{zone}}, PO Box {{po_box}}'),
  ('KW',
   '[{"key":"governorate","label":"Governorate","type":"select","options":["Al Asimah","Hawalli","Farwaniya","Mubarak Al-Kabeer","Ahmadi","Jahra"],"display_order":1},
     {"key":"area","label":"Area","display_order":2},
     {"key":"block","label":"Block","display_order":3},
     {"key":"street","label":"Street","display_order":4},
     {"key":"building","label":"Building","display_order":5}]',
   'Bldg {{building}}, Street {{street}}, Block {{block}}, {{area}}, {{governorate}}'),
  ('IN',
   '[{"key":"address_line1","label":"Address Line 1","required":true,"display_order":1,"width":"full"},
     {"key":"address_line2","label":"Address Line 2","display_order":2,"width":"full"},
     {"key":"city","label":"City","required":true,"display_order":3},
     {"key":"district","label":"District","display_order":4},
     {"key":"state","label":"State","type":"select","required":true,"options":["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Chandigarh","Puducherry","Jammu & Kashmir","Ladakh"],"display_order":5},
     {"key":"pin_code","label":"PIN Code","required":true,"validation":{"regex":"^[0-9]{6}$"},"display_order":6}]',
   '{{address_line1}}, {{address_line2}}, {{city}}, {{district}}, {{state}} {{pin_code}}'),
  ('GB',
   '[{"key":"address_line1","label":"Address Line 1","required":true,"display_order":1,"width":"full"},
     {"key":"address_line2","label":"Address Line 2","display_order":2,"width":"full"},
     {"key":"town_city","label":"Town / City","required":true,"display_order":3},
     {"key":"county","label":"County","display_order":4},
     {"key":"post_code","label":"Post Code","required":true,"validation":{"regex":"^[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}$"},"display_order":5}]',
   '{{address_line1}}, {{address_line2}}, {{town_city}}, {{county}} {{post_code}}'),
  ('US',
   '[{"key":"address_line1","label":"Address Line 1","required":true,"display_order":1,"width":"full"},
     {"key":"address_line2","label":"Address Line 2","display_order":2,"width":"full"},
     {"key":"city","label":"City","required":true,"display_order":3},
     {"key":"state","label":"State","type":"select","required":true,"options":["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"],"display_order":4},
     {"key":"zip","label":"ZIP Code","required":true,"validation":{"regex":"^[0-9]{5}(-[0-9]{4})?$"},"display_order":5},
     {"key":"county","label":"County","display_order":6}]',
   '{{address_line1}}, {{address_line2}}, {{city}}, {{state}} {{zip}}')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 5. Structured employee addresses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_addresses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  address_type  text NOT NULL DEFAULT 'current'
                  CHECK (address_type IN ('current', 'permanent', 'home_country')),
  country_code  char(2) NOT NULL REFERENCES countries(code),
  address_data  jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (employee_id, address_type)
);

CREATE INDEX IF NOT EXISTS idx_employee_addresses_employee ON employee_addresses(employee_id);

ALTER TABLE employee_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ea_all ON employee_addresses;
CREATE POLICY ea_all ON employee_addresses FOR ALL TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());

NOTIFY pgrst, 'reload schema';
