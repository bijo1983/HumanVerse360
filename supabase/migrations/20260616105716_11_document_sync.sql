
-- Add profile_sync flag to employee_documents
-- profile_sync=true means this row was auto-created from the employee profile fields
ALTER TABLE employee_documents ADD COLUMN IF NOT EXISTS profile_sync boolean NOT NULL DEFAULT false;

-- Partial unique index: only one profile-synced record per (employee, type)
CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_docs_profile_sync
  ON employee_documents(employee_id, document_type)
  WHERE profile_sync = true;

-- ─── employees → employee_documents trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_employee_to_docs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- prevent recursion: employee_documents trigger updates employees → fires this again
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- Passport
  IF NEW.passport_number IS NOT NULL THEN
    INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, country, profile_sync)
    VALUES (NEW.id, NEW.company_id, 'Passport', NEW.passport_number, NEW.passport_expiry, NEW.passport_issue_country, true)
    ON CONFLICT (employee_id, document_type) WHERE profile_sync = true
    DO UPDATE SET
      document_number = EXCLUDED.document_number,
      expiry_date     = EXCLUDED.expiry_date,
      country         = EXCLUDED.country,
      updated_at      = now();
  ELSE
    DELETE FROM employee_documents
    WHERE employee_id = NEW.id AND document_type = 'Passport' AND profile_sync = true;
  END IF;

  -- CPR
  IF NEW.cpr_number IS NOT NULL THEN
    INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, profile_sync)
    VALUES (NEW.id, NEW.company_id, 'CPR', NEW.cpr_number, NEW.cpr_expiry, true)
    ON CONFLICT (employee_id, document_type) WHERE profile_sync = true
    DO UPDATE SET
      document_number = EXCLUDED.document_number,
      expiry_date     = EXCLUDED.expiry_date,
      updated_at      = now();
  ELSE
    DELETE FROM employee_documents
    WHERE employee_id = NEW.id AND document_type = 'CPR' AND profile_sync = true;
  END IF;

  -- Visa
  IF NEW.visa_number IS NOT NULL THEN
    INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, notes, profile_sync)
    VALUES (NEW.id, NEW.company_id, 'Visa', NEW.visa_number, NEW.visa_expiry, NEW.visa_type, true)
    ON CONFLICT (employee_id, document_type) WHERE profile_sync = true
    DO UPDATE SET
      document_number = EXCLUDED.document_number,
      expiry_date     = EXCLUDED.expiry_date,
      notes           = EXCLUDED.notes,
      updated_at      = now();
  ELSE
    DELETE FROM employee_documents
    WHERE employee_id = NEW.id AND document_type = 'Visa' AND profile_sync = true;
  END IF;

  -- Work Permit
  IF NEW.work_permit_number IS NOT NULL THEN
    INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, profile_sync)
    VALUES (NEW.id, NEW.company_id, 'Work Permit', NEW.work_permit_number, NEW.work_permit_expiry, true)
    ON CONFLICT (employee_id, document_type) WHERE profile_sync = true
    DO UPDATE SET
      document_number = EXCLUDED.document_number,
      expiry_date     = EXCLUDED.expiry_date,
      updated_at      = now();
  ELSE
    DELETE FROM employee_documents
    WHERE employee_id = NEW.id AND document_type = 'Work Permit' AND profile_sync = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_to_docs ON employees;
CREATE TRIGGER trg_sync_employee_to_docs
AFTER INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION fn_sync_employee_to_docs();

-- ─── employee_documents → employees trigger ──────────────────────────────────
-- Only fires for manually-added docs (profile_sync=false) of the 4 core types
CREATE OR REPLACE FUNCTION fn_sync_doc_to_employee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.document_type = 'Passport' THEN
    UPDATE employees SET
      passport_number       = NEW.document_number,
      passport_expiry       = NEW.expiry_date,
      passport_issue_country = NEW.country,
      updated_at            = now()
    WHERE id = NEW.employee_id;

  ELSIF NEW.document_type = 'CPR' THEN
    UPDATE employees SET
      cpr_number  = NEW.document_number,
      cpr_expiry  = NEW.expiry_date,
      updated_at  = now()
    WHERE id = NEW.employee_id;

  ELSIF NEW.document_type = 'Visa' THEN
    UPDATE employees SET
      visa_number  = NEW.document_number,
      visa_expiry  = NEW.expiry_date,
      visa_type    = NEW.notes,
      updated_at   = now()
    WHERE id = NEW.employee_id;

  ELSIF NEW.document_type = 'Work Permit' THEN
    UPDATE employees SET
      work_permit_number  = NEW.document_number,
      work_permit_expiry  = NEW.expiry_date,
      updated_at          = now()
    WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_doc_to_employee ON employee_documents;
CREATE TRIGGER trg_sync_doc_to_employee
AFTER INSERT OR UPDATE ON employee_documents
FOR EACH ROW
WHEN (NEW.profile_sync = false AND NEW.document_type IN ('Passport', 'CPR', 'Visa', 'Work Permit'))
EXECUTE FUNCTION fn_sync_doc_to_employee();

-- Backfill: create profile-synced document records for existing employees
INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, country, profile_sync)
SELECT id, company_id, 'Passport', passport_number, passport_expiry, passport_issue_country, true
FROM employees WHERE passport_number IS NOT NULL
ON CONFLICT (employee_id, document_type) WHERE profile_sync = true DO UPDATE SET
  document_number = EXCLUDED.document_number, expiry_date = EXCLUDED.expiry_date, country = EXCLUDED.country;

INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, profile_sync)
SELECT id, company_id, 'CPR', cpr_number, cpr_expiry, true
FROM employees WHERE cpr_number IS NOT NULL
ON CONFLICT (employee_id, document_type) WHERE profile_sync = true DO UPDATE SET
  document_number = EXCLUDED.document_number, expiry_date = EXCLUDED.expiry_date;

INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, notes, profile_sync)
SELECT id, company_id, 'Visa', visa_number, visa_expiry, visa_type, true
FROM employees WHERE visa_number IS NOT NULL
ON CONFLICT (employee_id, document_type) WHERE profile_sync = true DO UPDATE SET
  document_number = EXCLUDED.document_number, expiry_date = EXCLUDED.expiry_date, notes = EXCLUDED.notes;

INSERT INTO employee_documents(employee_id, company_id, document_type, document_number, expiry_date, profile_sync)
SELECT id, company_id, 'Work Permit', work_permit_number, work_permit_expiry, true
FROM employees WHERE work_permit_number IS NOT NULL
ON CONFLICT (employee_id, document_type) WHERE profile_sync = true DO UPDATE SET
  document_number = EXCLUDED.document_number, expiry_date = EXCLUDED.expiry_date;
