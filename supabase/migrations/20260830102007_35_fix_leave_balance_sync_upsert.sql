CREATE OR REPLACE FUNCTION sync_leave_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_year int;
  v_entitled numeric;
BEGIN
  v_year := COALESCE(NEW.year, EXTRACT(YEAR FROM NEW.start_date)::int);
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Pending' THEN
      SELECT days_per_year INTO v_entitled FROM leave_types WHERE id = NEW.leave_type_id;
      INSERT INTO leave_balances (employee_id, leave_type_id, year, company_id, entitled_days, used_days, pending_days, carried_forward)
      VALUES (NEW.employee_id, NEW.leave_type_id, v_year, NEW.company_id, COALESCE(v_entitled, 0), 0, NEW.days_requested, 0)
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET pending_days = leave_balances.pending_days + NEW.days_requested;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'Pending' AND NEW.status = 'Approved' THEN
      SELECT days_per_year INTO v_entitled FROM leave_types WHERE id = NEW.leave_type_id;
      INSERT INTO leave_balances (employee_id, leave_type_id, year, company_id, entitled_days, used_days, pending_days, carried_forward)
      VALUES (NEW.employee_id, NEW.leave_type_id, v_year, NEW.company_id, COALESCE(v_entitled, 0), NEW.days_requested, 0, 0)
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        pending_days = GREATEST(0, leave_balances.pending_days - OLD.days_requested),
        used_days    = leave_balances.used_days + NEW.days_requested;
    ELSIF OLD.status = 'Pending' AND NEW.status IN ('Rejected', 'Cancelled') THEN
      UPDATE leave_balances
      SET pending_days = GREATEST(0, pending_days - OLD.days_requested)
      WHERE employee_id  = NEW.employee_id
        AND leave_type_id = NEW.leave_type_id
        AND year          = v_year;
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

INSERT INTO leave_balances (employee_id, leave_type_id, year, company_id, entitled_days, used_days, pending_days, carried_forward)
SELECT
  lr.employee_id,
  lr.leave_type_id,
  lr.year,
  lr.company_id,
  COALESCE(lt.days_per_year, 0),
  COALESCE(SUM(lr.days_requested) FILTER (WHERE lr.status = 'Approved'), 0),
  COALESCE(SUM(lr.days_requested) FILTER (WHERE lr.status = 'Pending'), 0),
  0
FROM leave_requests lr
JOIN leave_types lt ON lt.id = lr.leave_type_id
GROUP BY lr.employee_id, lr.leave_type_id, lr.year, lr.company_id, lt.days_per_year
ON CONFLICT (employee_id, leave_type_id, year) DO UPDATE SET
  used_days    = EXCLUDED.used_days,
  pending_days = EXCLUDED.pending_days;

NOTIFY pgrst, 'reload schema';