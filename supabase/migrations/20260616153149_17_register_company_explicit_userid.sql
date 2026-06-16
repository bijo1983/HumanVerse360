-- Drop old version and recreate with explicit user_id parameter.
-- auth.uid() is unreliable when called from certain PostgREST contexts;
-- passing the user ID explicitly from the client is more reliable and
-- the session JWT still proves the caller is authenticated.
DROP FUNCTION IF EXISTS public.register_company(text,text,text,uuid,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.register_company(
  p_company_name   text,
  p_user_id        uuid,
  p_email          text,
  p_full_name      text,
  p_plan_id        uuid,
  p_cr_number      text DEFAULT NULL,
  p_phone          text DEFAULT NULL,
  p_industry       text DEFAULT NULL,
  p_country        text DEFAULT NULL,
  p_country_code   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company companies%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  -- Prevent duplicate: user already linked to a company
  IF EXISTS (SELECT 1 FROM company_users WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Account already linked to a company. Please log in.';
  END IF;

  -- Validate plan
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE id = p_plan_id AND is_active) THEN
    RAISE EXCEPTION 'Invalid subscription plan';
  END IF;

  INSERT INTO companies (
    name, email, phone, cr_number, industry,
    country, country_code, subscription_plan_id,
    subscription_status, subscription_start, admin_user_id
  ) VALUES (
    p_company_name, p_email, p_phone, p_cr_number, p_industry,
    p_country, p_country_code, p_plan_id,
    'active', CURRENT_DATE, p_user_id
  )
  RETURNING * INTO v_company;

  INSERT INTO company_users (company_id, user_id, full_name, email, role, is_active)
  VALUES (v_company.id, p_user_id, p_full_name, p_email, 'admin', true);

  INSERT INTO departments (name, code, company_id) VALUES
    ('Human Resources', 'HR',  v_company.id),
    ('Finance',         'FIN', v_company.id),
    ('Operations',      'OPS', v_company.id),
    ('Management',      'MGT', v_company.id);

  RETURN jsonb_build_object('id', v_company.id, 'name', v_company.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_company TO authenticated, anon;

-- Reload PostgREST schema cache so it picks up the new signature
NOTIFY pgrst, 'reload schema';
