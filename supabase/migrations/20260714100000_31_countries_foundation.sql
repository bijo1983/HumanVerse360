-- ============================================================
-- 31: Multi-country foundation (Phase 0)
--     countries master + country_configurations + company linkage
-- ============================================================

-- ------------------------------------------------------------
-- Countries master
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS countries (
  code                 char(2) PRIMARY KEY,          -- ISO 3166-1 alpha-2
  name                 text NOT NULL,
  native_name          text,
  currency_code        char(3) NOT NULL,             -- ISO 4217
  currency_symbol      text NOT NULL,
  currency_decimals    smallint NOT NULL DEFAULT 2,  -- BHD/KWD/OMR/JOD = 3
  date_format          text NOT NULL DEFAULT 'DD/MM/YYYY',
  number_locale        text NOT NULL DEFAULT 'en',   -- Intl locale for number formatting
  default_timezone     text NOT NULL,
  dial_code            text,
  -- true = full payroll/statutory configuration is available for this country;
  -- false = selectable at registration only (generic defaults apply)
  is_payroll_supported boolean NOT NULL DEFAULT false,
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 100,
  created_at           timestamptz DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

-- Country list must be readable pre-auth (registration country picker)
CREATE POLICY countries_read ON countries FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY countries_admin_write ON countries FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

INSERT INTO countries
  (code, name, native_name, currency_code, currency_symbol, currency_decimals,
   date_format, number_locale, default_timezone, dial_code, is_payroll_supported, sort_order)
VALUES
  ('BH', 'Bahrain',              'البحرين',        'BHD', 'BD',  3, 'DD/MM/YYYY', 'en',    'Asia/Bahrain',     '+973', true, 10),
  ('AE', 'United Arab Emirates', 'الإمارات',       'AED', 'AED', 2, 'DD/MM/YYYY', 'en',    'Asia/Dubai',       '+971', true, 20),
  ('SA', 'Saudi Arabia',         'السعودية',       'SAR', 'SR',  2, 'DD/MM/YYYY', 'en',    'Asia/Riyadh',      '+966', true, 30),
  ('OM', 'Oman',                 'عُمان',          'OMR', 'RO',  3, 'DD/MM/YYYY', 'en',    'Asia/Muscat',      '+968', true, 40),
  ('QA', 'Qatar',                'قطر',            'QAR', 'QR',  2, 'DD/MM/YYYY', 'en',    'Asia/Qatar',       '+974', true, 50),
  ('KW', 'Kuwait',               'الكويت',         'KWD', 'KD',  3, 'DD/MM/YYYY', 'en',    'Asia/Kuwait',      '+965', true, 60),
  ('IN', 'India',                'भारत',           'INR', '₹',   2, 'DD/MM/YYYY', 'en-IN', 'Asia/Kolkata',     '+91',  true, 70),
  ('GB', 'United Kingdom',       NULL,             'GBP', '£',   2, 'DD/MM/YYYY', 'en-GB', 'Europe/London',    '+44',  true, 80),
  ('US', 'United States',        NULL,             'USD', '$',   2, 'MM/DD/YYYY', 'en-US', 'America/New_York', '+1',   true, 90),
  -- Registration-picker countries without payroll configuration (generic defaults)
  ('JO', 'Jordan',      'الأردن',   'JOD', 'JD',  3, 'DD/MM/YYYY', 'en', 'Asia/Amman',  '+962', false, 200),
  ('EG', 'Egypt',       'مصر',      'EGP', 'E£',  2, 'DD/MM/YYYY', 'en', 'Africa/Cairo','+20',  false, 210),
  ('LB', 'Lebanon',     'لبنان',    'LBP', 'L£',  2, 'DD/MM/YYYY', 'en', 'Asia/Beirut', '+961', false, 220),
  ('PK', 'Pakistan',    'پاکستان',  'PKR', '₨',   2, 'DD/MM/YYYY', 'en', 'Asia/Karachi','+92',  false, 230),
  ('PH', 'Philippines', NULL,       'PHP', '₱',   2, 'MM/DD/YYYY', 'en', 'Asia/Manila', '+63',  false, 240),
  ('BD', 'Bangladesh',  'বাংলাদেশ', 'BDT', '৳',   2, 'DD/MM/YYYY', 'en', 'Asia/Dhaka',  '+880', false, 250)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- Country configurations (versioned; NULL company_id = platform template)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS country_configurations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code                char(2) NOT NULL REFERENCES countries(code),
  company_id                  uuid REFERENCES companies(id) ON DELETE CASCADE,
  version                     integer NOT NULL DEFAULT 1,
  status                      text NOT NULL DEFAULT 'active'
                                CHECK (status IN ('draft', 'pending_approval', 'active', 'archived')),
  national_id_label           text NOT NULL,
  national_id_validation      text,                     -- regex
  tax_id_label                text,
  payroll_frequency           text NOT NULL DEFAULT 'monthly'
                                CHECK (payroll_frequency IN ('monthly', 'semi_monthly', 'bi_weekly', 'weekly')),
  weekend_days                smallint[] NOT NULL DEFAULT '{5,6}',   -- ISO: 1=Mon … 7=Sun
  default_working_days        numeric(5,2) NOT NULL DEFAULT 26,
  daily_hours                 numeric(4,2) NOT NULL DEFAULT 8,
  income_tax_applicable       boolean NOT NULL DEFAULT false,
  social_insurance_applicable boolean NOT NULL DEFAULT false,
  eosb_applicable             boolean NOT NULL DEFAULT false,
  gratuity_applicable         boolean NOT NULL DEFAULT false,
  wps_applicable              boolean NOT NULL DEFAULT false,
  config                      jsonb NOT NULL DEFAULT '{}',  -- extended payload (later phases)
  effective_from              date NOT NULL DEFAULT CURRENT_DATE,
  effective_to                date,
  created_by                  uuid REFERENCES auth.users(id),
  approved_by                 uuid REFERENCES auth.users(id),
  approved_at                 timestamptz,
  created_at                  timestamptz DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (country_code, company_id, version)
);

CREATE INDEX IF NOT EXISTS idx_country_config_lookup
  ON country_configurations (country_code, company_id, status, effective_from);

ALTER TABLE country_configurations ENABLE ROW LEVEL SECURITY;

-- Templates (company_id IS NULL) readable by everyone signed in; company rows by that company
CREATE POLICY cc_read ON country_configurations FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
CREATE POLICY cc_company_write ON country_configurations FOR ALL TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());
CREATE POLICY cc_platform_write ON country_configurations FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Platform template seeds (one active version per supported country)
INSERT INTO country_configurations
  (country_code, national_id_label, national_id_validation, tax_id_label,
   payroll_frequency, weekend_days, default_working_days, daily_hours,
   income_tax_applicable, social_insurance_applicable, eosb_applicable,
   gratuity_applicable, wps_applicable, effective_from)
VALUES
  ('BH', 'CPR Number',                '^[0-9]{9}$',                          NULL,
   'monthly', '{5,6}', 26, 8,  false, true,  true,  false, true,  '2020-01-01'),
  ('AE', 'Emirates ID',               '^784-?[0-9]{4}-?[0-9]{7}-?[0-9]$',    NULL,
   'monthly', '{6,7}', 26, 8,  false, true,  false, true,  true,  '2020-01-01'),
  ('SA', 'National ID / Iqama',       '^[12][0-9]{9}$',                      NULL,
   'monthly', '{5,6}', 26, 8,  false, true,  true,  false, true,  '2020-01-01'),
  ('OM', 'Civil ID',                  '^[0-9]{5,9}$',                        NULL,
   'monthly', '{5,6}', 26, 8,  false, true,  true,  false, false, '2020-01-01'),
  ('QA', 'QID',                       '^[0-9]{11}$',                         NULL,
   'monthly', '{5,6}', 26, 8,  false, false, true,  false, true,  '2020-01-01'),
  ('KW', 'Civil ID',                  '^[0-9]{12}$',                         NULL,
   'monthly', '{5,6}', 26, 8,  false, true,  true,  false, false, '2020-01-01'),
  ('IN', 'Aadhaar Number',            '^[0-9]{12}$',                         'PAN',
   'monthly', '{6,7}', 26, 8,  true,  true,  false, true,  false, '2020-01-01'),
  ('GB', 'National Insurance Number', '^[A-CEGHJ-PR-TW-Z]{2}[0-9]{6}[A-D]$', 'Tax Code',
   'monthly', '{6,7}', 21.67, 7.5, true, true, false, false, false, '2020-01-01'),
  ('US', 'SSN',                       '^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$',      'SSN',
   'semi_monthly', '{6,7}', 21.67, 8, true, true, false, false, false, '2020-01-01')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- Company linkage
-- ------------------------------------------------------------
-- country_code text column already exists (migration 09) with DEFAULT 'BH'
UPDATE companies SET country_code = 'BH' WHERE country_code IS NULL OR country_code = '';

ALTER TABLE companies ADD COLUMN IF NOT EXISTS currency_code char(3);

UPDATE companies c
SET currency_code = co.currency_code
FROM countries co
WHERE co.code = c.country_code
  AND c.currency_code IS NULL;

-- Companies whose country is not in the master (e.g. legacy 'OTHER') keep BHD
UPDATE companies SET currency_code = 'BHD' WHERE currency_code IS NULL;

-- Keep currency in sync when a company's country changes (unless explicitly set)
CREATE OR REPLACE FUNCTION sync_company_currency() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.currency_code IS NULL)
     OR (TG_OP = 'UPDATE' AND NEW.country_code IS DISTINCT FROM OLD.country_code) THEN
    SELECT currency_code INTO NEW.currency_code FROM countries WHERE code = NEW.country_code;
    IF NEW.currency_code IS NULL THEN
      NEW.currency_code := 'BHD';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_company_currency ON companies;
CREATE TRIGGER trg_sync_company_currency
  BEFORE INSERT OR UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION sync_company_currency();

NOTIFY pgrst, 'reload schema';
