
DROP POLICY IF EXISTS open_insert ON calculation_settings;
DROP POLICY IF EXISTS open_update ON calculation_settings;
DROP POLICY IF EXISTS open_delete ON calculation_settings;
CREATE POLICY calc_insert ON calculation_settings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY calc_update ON calculation_settings FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY calc_delete ON calculation_settings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
