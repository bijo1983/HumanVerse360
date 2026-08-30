-- ============================================================
-- 35: Formula versioning + maker-checker + audit log (Phase 4)
-- ============================================================

CREATE TABLE IF NOT EXISTS formula_versions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A version belongs to a payroll component OR a calculation_settings formula
  component_id       uuid REFERENCES payroll_components(id) ON DELETE CASCADE,
  setting_code       text,             -- calculation_settings.code (e.g. NET_SALARY, LEAVE_PAY)
  country_code       char(2) REFERENCES countries(code),
  company_id         uuid REFERENCES companies(id) ON DELETE CASCADE,   -- NULL = platform
  version_number     integer NOT NULL,
  formula_expression text NOT NULL,
  variables_used     text[],           -- extracted by analyzeFormula() at save time
  effective_from     date NOT NULL DEFAULT CURRENT_DATE,
  effective_to       date,
  approval_status    text NOT NULL DEFAULT 'draft'
                       CHECK (approval_status IN ('draft','pending_approval','approved','rejected','superseded')),
  change_reason      text,
  created_by         uuid REFERENCES auth.users(id),
  approved_by        uuid REFERENCES auth.users(id),
  approved_at        timestamptz,
  created_at         timestamptz DEFAULT now(),
  CHECK (component_id IS NOT NULL OR setting_code IS NOT NULL),
  UNIQUE NULLS NOT DISTINCT (component_id, setting_code, company_id, version_number)
);
CREATE INDEX IF NOT EXISTS idx_fv_component ON formula_versions(component_id, approval_status, effective_from);
CREATE INDEX IF NOT EXISTS idx_fv_setting ON formula_versions(setting_code, approval_status, effective_from);

ALTER TABLE formula_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fv_read ON formula_versions;
CREATE POLICY fv_read ON formula_versions FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = get_current_company_id());
DROP POLICY IF EXISTS fv_company_write ON formula_versions;
CREATE POLICY fv_company_write ON formula_versions FOR ALL TO authenticated
  USING (company_id = get_current_company_id())
  WITH CHECK (company_id = get_current_company_id());
DROP POLICY IF EXISTS fv_platform_write ON formula_versions;
CREATE POLICY fv_platform_write ON formula_versions FOR ALL TO authenticated
  USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Maker-checker: the approver must be a different user than the author
CREATE OR REPLACE FUNCTION enforce_formula_maker_checker() RETURNS trigger AS $$
BEGIN
  IF NEW.approval_status = 'approved'
     AND NEW.approved_by IS NOT NULL
     AND NEW.created_by IS NOT NULL
     AND NEW.approved_by = NEW.created_by THEN
    RAISE EXCEPTION 'Formula versions must be approved by a different user than the author (maker-checker)';
  END IF;
  IF NEW.approval_status = 'approved' AND NEW.approved_at IS NULL THEN
    NEW.approved_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_formula_maker_checker ON formula_versions;
CREATE TRIGGER trg_formula_maker_checker
  BEFORE INSERT OR UPDATE ON formula_versions
  FOR EACH ROW EXECUTE FUNCTION enforce_formula_maker_checker();

-- When a new version is approved, supersede older approved versions
CREATE OR REPLACE FUNCTION supersede_old_formula_versions() RETURNS trigger AS $$
BEGIN
  IF NEW.approval_status = 'approved' THEN
    UPDATE formula_versions
    SET approval_status = 'superseded',
        effective_to = COALESCE(effective_to, NEW.effective_from - 1)
    WHERE approval_status = 'approved'
      AND id <> NEW.id
      AND version_number < NEW.version_number
      AND component_id IS NOT DISTINCT FROM NEW.component_id
      AND setting_code IS NOT DISTINCT FROM NEW.setting_code
      AND company_id IS NOT DISTINCT FROM NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supersede_formula_versions ON formula_versions;
CREATE TRIGGER trg_supersede_formula_versions
  AFTER INSERT OR UPDATE ON formula_versions
  FOR EACH ROW EXECUTE FUNCTION supersede_old_formula_versions();

-- ------------------------------------------------------------
-- Seed version 1 (approved, migration-authored) for existing formulas
-- ------------------------------------------------------------
-- From calculation_settings (Bahrain-era formula catalogue)
INSERT INTO formula_versions
  (setting_code, version_number, formula_expression, approval_status, change_reason, effective_from)
SELECT cs.code, 1, cs.formula, 'approved', 'Migrated from calculation_settings', '2020-01-01'
FROM calculation_settings cs
WHERE cs.formula IS NOT NULL AND cs.formula <> ''
  AND NOT EXISTS (
    SELECT 1 FROM formula_versions fv WHERE fv.setting_code = cs.code AND fv.company_id IS NULL
  );

-- From platform payroll component formulas
INSERT INTO formula_versions
  (component_id, country_code, version_number, formula_expression, approval_status, change_reason, effective_from)
SELECT pc.id, pc.country_code, 1, pc.formula, 'approved', 'Seeded with country component template', pc.effective_from
FROM payroll_components pc
WHERE pc.company_id IS NULL AND pc.calculation_type = 'formula' AND pc.formula IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM formula_versions fv WHERE fv.component_id = pc.id
  );

-- ------------------------------------------------------------
-- Configuration / payroll audit log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_audit_logs (
  id           bigserial PRIMARY KEY,
  company_id   uuid,
  actor_id     uuid REFERENCES auth.users(id),
  entity_type  text NOT NULL,   -- 'formula_version','payroll_component','country_configuration','payroll_run','statutory_rule','field_definition'
  entity_id    text,
  action       text NOT NULL,   -- 'create','update','approve','reject','process','delete','view_sensitive'
  before_state jsonb,
  after_state  jsonb,
  reason       text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON payroll_audit_logs(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_company_time ON payroll_audit_logs(company_id, created_at);

ALTER TABLE payroll_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pal_read ON payroll_audit_logs;
CREATE POLICY pal_read ON payroll_audit_logs FOR SELECT TO authenticated
  USING (company_id = get_current_company_id() OR is_platform_admin());
DROP POLICY IF EXISTS pal_insert ON payroll_audit_logs;
CREATE POLICY pal_insert ON payroll_audit_logs FOR INSERT TO authenticated
  WITH CHECK (company_id = get_current_company_id() OR is_platform_admin());

-- Automatic audit on formula and component changes
CREATE OR REPLACE FUNCTION audit_config_change() RETURNS trigger AS $$
BEGIN
  INSERT INTO payroll_audit_logs (company_id, actor_id, entity_type, entity_id, action, before_state, after_state)
  VALUES (
    COALESCE(NEW.company_id, OLD.company_id),
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_formula_versions ON formula_versions;
CREATE TRIGGER trg_audit_formula_versions
  AFTER INSERT OR UPDATE OR DELETE ON formula_versions
  FOR EACH ROW EXECUTE FUNCTION audit_config_change();

DROP TRIGGER IF EXISTS trg_audit_payroll_components ON payroll_components;
CREATE TRIGGER trg_audit_payroll_components
  AFTER INSERT OR UPDATE OR DELETE ON payroll_components
  FOR EACH ROW EXECUTE FUNCTION audit_config_change();

DROP TRIGGER IF EXISTS trg_audit_country_configurations ON country_configurations;
CREATE TRIGGER trg_audit_country_configurations
  AFTER INSERT OR UPDATE OR DELETE ON country_configurations
  FOR EACH ROW EXECUTE FUNCTION audit_config_change();

NOTIFY pgrst, 'reload schema';
