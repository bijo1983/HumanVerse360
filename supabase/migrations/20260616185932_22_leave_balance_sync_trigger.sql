-- ── Trigger: keep leave_balances in sync with leave_requests status changes ──

CREATE OR REPLACE FUNCTION sync_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_year int;
BEGIN
  v_year := COALESCE(NEW.year, EXTRACT(YEAR FROM NEW.start_date)::int);

  IF TG_OP = 'INSERT' THEN
    -- New request submitted as Pending → add to pending_days
    IF NEW.status = 'Pending' THEN
      UPDATE leave_balances
      SET pending_days = pending_days + NEW.days_requested
      WHERE employee_id  = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year          = v_year;
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN

    -- Pending → Approved: move from pending to used
    IF OLD.status = 'Pending' AND NEW.status = 'Approved' THEN
      UPDATE leave_balances
      SET pending_days = GREATEST(0, pending_days - OLD.days_requested),
          used_days    = used_days + NEW.days_requested
      WHERE employee_id  = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year          = v_year;

    -- Pending → Rejected / Cancelled: remove from pending
    ELSIF OLD.status = 'Pending' AND NEW.status IN ('Rejected', 'Cancelled') THEN
      UPDATE leave_balances
      SET pending_days = GREATEST(0, pending_days - OLD.days_requested)
      WHERE employee_id  = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year          = v_year;

    -- Approved → Cancelled: remove from used
    ELSIF OLD.status = 'Approved' AND NEW.status = 'Cancelled' THEN
      UPDATE leave_balances
      SET used_days = GREATEST(0, used_days - OLD.days_requested)
      WHERE employee_id  = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year          = v_year;

    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS leave_request_balance_sync ON leave_requests;
CREATE TRIGGER leave_request_balance_sync
  AFTER INSERT OR UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION sync_leave_balance();

-- ── Backfill: fix balances for already-approved requests ─────────────────────
-- Annual Leave employee: ac084012, 26 + 1 = 27 days approved
UPDATE leave_balances
SET used_days = 27
WHERE employee_id   = 'ac084012-6aec-4756-a253-3635946f0966'
  AND leave_type_id = '03068690-a415-403d-938b-8ff28ee6b5e9'
  AND year          = 2026;

-- Sick Leave employee: ac084012, 2 days approved
UPDATE leave_balances
SET used_days = 2
WHERE employee_id   = 'ac084012-6aec-4756-a253-3635946f0966'
  AND leave_type_id = 'e56a38e9-726a-46ff-9271-63f5877991af'
  AND year          = 2026;
