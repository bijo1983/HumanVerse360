
DROP POLICY IF EXISTS open_insert ON indemnity_settings;
DROP POLICY IF EXISTS open_update ON indemnity_settings;
DROP POLICY IF EXISTS open_delete ON indemnity_settings;
CREATE POLICY indem_insert ON indemnity_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY indem_update ON indemnity_settings FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY indem_delete ON indemnity_settings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
