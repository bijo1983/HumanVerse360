-- Test setting_lookups + register_company + platform_settings
DROP POLICY IF EXISTS select_setting_lookups ON setting_lookups;
CREATE POLICY select_setting_lookups ON setting_lookups
  FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());

DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.register_company(
      text, uuid, text, text, uuid, text, text, text, text, text) FROM anon;
  EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN
    REVOKE EXECUTE ON FUNCTION public.register_company(
      text, text, text, uuid, text, text, text, text, text) FROM anon;
  EXCEPTION WHEN undefined_function THEN NULL; END;
END $$;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ps_select ON platform_settings FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY ps_insert ON platform_settings FOR INSERT TO authenticated WITH CHECK (is_platform_admin());
CREATE POLICY ps_update ON platform_settings FOR UPDATE TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());
CREATE POLICY ps_delete ON platform_settings FOR DELETE TO authenticated USING (is_platform_admin());
