
DROP POLICY IF EXISTS open_insert ON salary_components;
DROP POLICY IF EXISTS open_update ON salary_components;
DROP POLICY IF EXISTS open_delete ON salary_components;
CREATE POLICY sc_insert ON salary_components FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY sc_update ON salary_components FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY sc_delete ON salary_components FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
