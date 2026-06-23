ALTER TABLE company_users ADD COLUMN IF NOT EXISTS can_delete_payroll boolean NOT NULL DEFAULT false;

-- Admins always get this right by default
UPDATE company_users SET can_delete_payroll = true WHERE role = 'admin';
