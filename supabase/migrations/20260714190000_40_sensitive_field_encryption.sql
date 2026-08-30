-- ============================================================
-- 40: Encryption at rest + access control for sensitive employee
--     custom fields (Phase 9d)
-- ============================================================
-- Scope: custom_fields.is_sensitive fields (currently: India PAN Number;
-- the mechanism generalizes to any future sensitive field a country
-- template adds). Values are encrypted transparently by a trigger and
-- never persisted in plaintext; reading a sensitive value back requires
-- an explicit, permission-gated, audited RPC call.
--
-- This migration is Supabase-specific: it uses Supabase Vault
-- (schema `vault`, built on pgsodium) to hold the symmetric key rather
-- than embedding it in SQL, so it never appears in migration history,
-- logs, or `pg_stat_statements`.
--
-- Note on scope: the national ID / bank account fields (cpr_number,
-- bank_account, iban) are physical columns on `employees`, not EAV rows
-- in employee_custom_values, and are read directly by many existing
-- screens (payslips, WPS SIF export, employee forms). Encrypting those
-- columns at rest would require rewriting every read site to go through
-- a decrypt RPC and is left as a follow-up — this migration does not
-- claim to cover them. What it does add for those fields today: masking
-- in the UI (already shipped in Phase 7) and the same permission model
-- (can_view_sensitive_fields) is available for gating any future unmask
-- action on them.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. Encryption key, stored in Supabase Vault (create once)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'employee_field_encryption_key') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'employee_field_encryption_key');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION get_field_encryption_key() RETURNS text AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'employee_field_encryption_key';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- 2. Permission: who may reveal a sensitive value
-- ------------------------------------------------------------
ALTER TABLE company_users ADD COLUMN IF NOT EXISTS can_view_sensitive_fields boolean NOT NULL DEFAULT false;
UPDATE company_users SET can_view_sensitive_fields = true WHERE role = 'admin' AND can_view_sensitive_fields = false;

-- ------------------------------------------------------------
-- 3. Encrypted storage column + write-side trigger
-- ------------------------------------------------------------
ALTER TABLE employee_custom_values ADD COLUMN IF NOT EXISTS value_encrypted bytea;

CREATE OR REPLACE FUNCTION encrypt_sensitive_custom_value() RETURNS trigger AS $$
DECLARE
  v_is_sensitive boolean;
BEGIN
  SELECT is_sensitive INTO v_is_sensitive FROM custom_fields WHERE id = NEW.custom_field_id;
  IF v_is_sensitive THEN
    IF NEW.value IS NOT NULL AND NEW.value <> '' THEN
      NEW.value_encrypted := pgp_sym_encrypt(NEW.value, get_field_encryption_key());
    ELSIF NEW.value = '' THEN
      NEW.value_encrypted := NULL;
    END IF;
    -- Never persist the plaintext for a sensitive field.
    NEW.value := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_encrypt_sensitive_custom_value ON employee_custom_values;
CREATE TRIGGER trg_encrypt_sensitive_custom_value
  BEFORE INSERT OR UPDATE ON employee_custom_values
  FOR EACH ROW EXECUTE FUNCTION encrypt_sensitive_custom_value();

-- Encrypt any sensitive values that were saved in plaintext before this migration
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT ecv.id, ecv.value
    FROM employee_custom_values ecv
    JOIN custom_fields cf ON cf.id = ecv.custom_field_id
    WHERE cf.is_sensitive AND ecv.value IS NOT NULL AND ecv.value <> ''
  LOOP
    UPDATE employee_custom_values
    SET value_encrypted = pgp_sym_encrypt(r.value, get_field_encryption_key()), value = NULL
    WHERE id = r.id;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. Read-side RPC: permission-gated, audited decrypt
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_employee_field_value(p_employee_id uuid, p_field_key text)
RETURNS text AS $$
DECLARE
  v_company_id uuid;
  v_field_id uuid;
  v_is_sensitive boolean;
  v_value text;
  v_value_encrypted bytea;
  v_row_id uuid;
  v_can_view boolean;
BEGIN
  SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
  IF v_company_id IS NULL OR v_company_id <> get_current_company_id() THEN
    RAISE EXCEPTION 'Employee not found in current company';
  END IF;

  SELECT id, is_sensitive INTO v_field_id, v_is_sensitive
  FROM custom_fields WHERE field_key = p_field_key
  AND (company_id = v_company_id OR company_id IS NULL)
  ORDER BY company_id NULLS LAST LIMIT 1;
  IF v_field_id IS NULL THEN RETURN NULL; END IF;

  SELECT id, value, value_encrypted INTO v_row_id, v_value, v_value_encrypted
  FROM employee_custom_values WHERE employee_id = p_employee_id AND custom_field_id = v_field_id;
  IF v_row_id IS NULL THEN RETURN NULL; END IF;

  IF NOT v_is_sensitive THEN
    RETURN v_value;
  END IF;

  SELECT can_view_sensitive_fields INTO v_can_view
  FROM company_users WHERE user_id = auth.uid() AND company_id = v_company_id AND is_active = true;
  IF NOT COALESCE(v_can_view, false) AND NOT is_platform_admin() THEN
    RAISE EXCEPTION 'insufficient_privilege: not authorized to view this field';
  END IF;

  INSERT INTO payroll_audit_logs (company_id, actor_id, entity_type, entity_id, action, reason)
  VALUES (v_company_id, auth.uid(), 'employee_custom_values', v_row_id::text, 'view_sensitive', p_field_key);

  IF v_value_encrypted IS NULL THEN RETURN NULL; END IF;
  RETURN pgp_sym_decrypt(v_value_encrypted, get_field_encryption_key());
EXCEPTION WHEN others THEN
  IF SQLERRM LIKE 'insufficient_privilege%' THEN RAISE; END IF;
  RETURN NULL; -- decryption failure (e.g. key rotated) never leaks internals
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
