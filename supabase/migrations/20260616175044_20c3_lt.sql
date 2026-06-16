
DROP POLICY IF EXISTS open_insert ON leave_types;
DROP POLICY IF EXISTS open_update ON leave_types;
DROP POLICY IF EXISTS open_delete ON leave_types;
CREATE POLICY lt_insert ON leave_types FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY lt_update ON leave_types FOR UPDATE TO authenticated
  USING  (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
CREATE POLICY lt_delete ON leave_types FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_users WHERE user_id = auth.uid() AND is_active = true AND role = 'admin'));
