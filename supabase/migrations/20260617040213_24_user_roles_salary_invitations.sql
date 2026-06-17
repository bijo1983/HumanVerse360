-- Add salary visibility flag to company_users
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS show_salary boolean NOT NULL DEFAULT false;

-- Owners and HR see salary by default
UPDATE company_users SET show_salary = true WHERE role IN ('admin', 'hr');

-- Rename 'hr' to keep, add 'it_admin' as valid — roles are just text, no enum constraint to change

-- User invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  email         text NOT NULL,
  full_name     text NOT NULL,
  role          text NOT NULL DEFAULT 'viewer',
  show_salary   boolean NOT NULL DEFAULT false,
  token         text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  module_overrides text[],
  invited_by    uuid REFERENCES auth.users(id),
  expires_at    timestamptz NOT NULL DEFAULT now() + interval '7 days',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_select" ON user_invitations FOR SELECT
  TO authenticated USING (company_id = get_current_company_id());

CREATE POLICY "inv_insert" ON user_invitations FOR INSERT
  TO authenticated WITH CHECK (company_id = get_current_company_id());

CREATE POLICY "inv_update" ON user_invitations FOR UPDATE
  TO authenticated USING (company_id = get_current_company_id());

CREATE POLICY "inv_delete" ON user_invitations FOR DELETE
  TO authenticated USING (company_id = get_current_company_id());

-- Public read by token (for accept-invite page before auth)
CREATE POLICY "inv_read_by_token" ON user_invitations FOR SELECT
  TO anon USING (true);

-- ── get_invitation_by_token ────────────────────────────────────────────────────
-- Called by unauthenticated accept-invite page to show invitation details
CREATE OR REPLACE FUNCTION get_invitation_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id',           inv.id,
    'email',        inv.email,
    'full_name',    inv.full_name,
    'role',         inv.role,
    'show_salary',  inv.show_salary,
    'status',       inv.status,
    'expires_at',   inv.expires_at,
    'company_name', c.name,
    'company_logo', c.logo_url
  )
  FROM user_invitations inv
  JOIN companies c ON c.id = inv.company_id
  WHERE inv.token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_invitation_by_token(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_invitation_by_token(text) TO anon, authenticated;

-- ── accept_user_invitation ─────────────────────────────────────────────────────
-- Called after auth.signUp + signIn; links the new user to their company
CREATE OR REPLACE FUNCTION accept_user_invitation(p_token text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM user_invitations
  WHERE token = p_token AND status = 'pending' AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or has expired.');
  END IF;

  -- Prevent duplicate company_users rows
  IF EXISTS (SELECT 1 FROM company_users WHERE company_id = v_inv.company_id AND user_id = p_user_id) THEN
    UPDATE user_invitations SET status = 'accepted' WHERE id = v_inv.id;
    RETURN jsonb_build_object('success', true);
  END IF;

  INSERT INTO company_users (company_id, user_id, full_name, email, role, show_salary, is_active, invited_by)
  VALUES (v_inv.company_id, p_user_id, v_inv.full_name, v_inv.email, v_inv.role, v_inv.show_salary, true, v_inv.invited_by);

  IF v_inv.module_overrides IS NOT NULL AND array_length(v_inv.module_overrides, 1) > 0 THEN
    INSERT INTO company_user_modules (company_id, user_id, module)
    SELECT v_inv.company_id, p_user_id, unnest(v_inv.module_overrides)
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE user_invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object('success', true, 'company_id', v_inv.company_id, 'role', v_inv.role);
END;
$$;

REVOKE ALL ON FUNCTION accept_user_invitation(text, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION accept_user_invitation(text, uuid) TO authenticated;
