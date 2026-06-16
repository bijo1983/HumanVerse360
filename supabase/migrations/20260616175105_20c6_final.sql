
DROP POLICY IF EXISTS companies_insert ON companies;

CREATE POLICY email_otps_deny_direct ON email_otps
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);
