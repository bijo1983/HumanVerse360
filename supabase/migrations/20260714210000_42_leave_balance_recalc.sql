-- ============================================================
-- 42: Leave balance sync — switch from incremental deltas to
--     full recalculation (fixes remaining edge cases)
-- ============================================================
-- Migration 41 fixed the "no balance row exists yet" gap, but kept
-- tracking pending/used as incremental deltas tied to specific status
-- *transitions* (Pending->Approved, Pending->Rejected, etc). That
-- design has its own gaps:
--   - A leave_requests row inserted directly with status='Approved'
--     (skipping 'Pending') is never added to used_days — the INSERT
--     branch only handled NEW.status = 'Pending'.
--   - Editing an already-approved request's days_requested/dates
--     without changing its status is invisible to the trigger, since
--     it only fires logic when OLD.status IS DISTINCT FROM NEW.status.
--   - A deleted leave_requests row leaves its contribution stranded
--     in the balance forever (no DELETE handling existed at all).
--
-- Fix: stop tracking deltas. On every insert/update/delete, fully
-- recompute the affected (employee, leave_type, year) balance directly
-- from the current leave_requests data — this is correct by
-- construction regardless of how the row changed, and immune to this
-- entire class of edge case.

CREATE OR REPLACE FUNCTION recalc_leave_balance(
  p_employee_id uuid, p_leave_type_id uuid, p_year int
) RETURNS void AS $$
DECLARE
  v_company_id uuid;
  v_entitled numeric;
  v_used numeric;
  v_pending numeric;
BEGIN
  SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
  IF v_company_id IS NULL THEN RETURN; END IF;

  SELECT days_per_year INTO v_entitled FROM leave_types WHERE id = p_leave_type_id;

  SELECT
    COALESCE(SUM(days_requested) FILTER (WHERE status = 'Approved'), 0),
    COALESCE(SUM(days_requested) FILTER (WHERE status = 'Pending'), 0)
  INTO v_used, v_pending
  FROM leave_requests
  WHERE employee_id = p_employee_id AND leave_type_id = p_leave_type_id AND year = p_year;

  INSERT INTO leave_balances (employee_id, leave_type_id, year, company_id, entitled_days, used_days, pending_days, carried_forward)
  VALUES (p_employee_id, p_leave_type_id, p_year, v_company_id, COALESCE(v_entitled, 0), v_used, v_pending, 0)
  ON CONFLICT (employee_id, leave_type_id, year)
  DO UPDATE SET used_days = v_used, pending_days = v_pending;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION sync_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_year_new int;
  v_year_old int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_year_old := COALESCE(OLD.year, EXTRACT(YEAR FROM OLD.start_date)::int);
    PERFORM recalc_leave_balance(OLD.employee_id, OLD.leave_type_id, v_year_old);
    RETURN OLD;
  END IF;

  v_year_new := COALESCE(NEW.year, EXTRACT(YEAR FROM NEW.start_date)::int);
  PERFORM recalc_leave_balance(NEW.employee_id, NEW.leave_type_id, v_year_new);

  -- If this update moved the request to a different employee/leave
  -- type/year, the old bucket it used to count against also needs
  -- recomputing — otherwise its old contribution stays stranded there.
  IF TG_OP = 'UPDATE' THEN
    v_year_old := COALESCE(OLD.year, EXTRACT(YEAR FROM OLD.start_date)::int);
    IF OLD.employee_id IS DISTINCT FROM NEW.employee_id
       OR OLD.leave_type_id IS DISTINCT FROM NEW.leave_type_id
       OR v_year_old IS DISTINCT FROM v_year_new THEN
      PERFORM recalc_leave_balance(OLD.employee_id, OLD.leave_type_id, v_year_old);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS leave_request_balance_sync ON leave_requests;
CREATE TRIGGER leave_request_balance_sync
  AFTER INSERT OR UPDATE OR DELETE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION sync_leave_balance();

-- ------------------------------------------------------------
-- Re-run the full recalculation for every (employee, leave_type, year)
-- combination that currently has any leave_requests row, correcting
-- whatever drifted while the delta-based trigger was in effect.
-- ------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT employee_id, leave_type_id, year FROM leave_requests
  LOOP
    PERFORM recalc_leave_balance(r.employee_id, r.leave_type_id, r.year);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Also: make unpaid-leave deductions visible as their own payslip
-- line, instead of being silently baked into a reduced Basic Salary
-- figure. Basic now always shows the full contracted amount; the
-- monetary value of unpaid leave/absence days is broken out into this
-- new column, matching how Loan/Other deductions already work.
-- ============================================================
ALTER TABLE payroll_line_items ADD COLUMN IF NOT EXISTS leave_deduction numeric(12,3) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
