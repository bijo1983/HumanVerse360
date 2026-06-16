-- Company settings (SMTP, branding)
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_pass TEXT,
  smtp_from_email TEXT,
  smtp_from_name TEXT,
  smtp_secure BOOLEAN DEFAULT false,
  smtp_enabled BOOLEAN DEFAULT false,
  leave_approval_required BOOLEAN DEFAULT true,
  leave_max_consecutive_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_company_settings" ON company_settings FOR SELECT
  TO authenticated USING (company_id = get_current_company_id());
CREATE POLICY "insert_own_company_settings" ON company_settings FOR INSERT
  TO authenticated WITH CHECK (company_id = get_current_company_id());
CREATE POLICY "update_own_company_settings" ON company_settings FOR UPDATE
  TO authenticated USING (company_id = get_current_company_id()) WITH CHECK (company_id = get_current_company_id());
CREATE POLICY "delete_own_company_settings" ON company_settings FOR DELETE
  TO authenticated USING (company_id = get_current_company_id());

-- Platform SMTP (superadmin)
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Leave type config columns
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'any'
  CHECK (approval_level IN ('any','manager','hr','admin'));
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS max_carryforward INTEGER DEFAULT 0;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS require_document BOOLEAN DEFAULT false;
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS min_days_notice INTEGER DEFAULT 0;

-- Companies table - ensure optional fields exist
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
