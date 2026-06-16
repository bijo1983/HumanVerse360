-- Test just ALTER FUNCTION + REVOKE statements
ALTER FUNCTION public.is_platform_admin()        SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_employee_to_docs() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_doc_to_employee()  SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_company_id()   SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION public.get_current_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin()      FROM anon;
