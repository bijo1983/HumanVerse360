import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { getDaysInMonth } from 'date-fns';
import { evaluateFormula } from '../../lib/calculations';
import { computeStatutory } from '../../lib/statutory';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function r3(n) { return Math.round(Number(n || 0) * 1000) / 1000; }

// Builds the shared variables context for formula evaluation
function buildFormulaContext(row, settings, dim, gosiEmp, gosiEr, otAmt, basicPro, gross, totalDed) {
  const basic = Number(row.basic_salary) || 0;
  const housing   = Number(row.housing_allowance) || 0;
  const transport = Number(row.transport_allowance) || 0;
  const food      = Number(row.food_allowance) || 0;
  const other     = Number(row.other_allowances) || 0;
  return {
    basic_salary:        basic,
    housing_allowance:   housing,
    transport_allowance: transport,
    food_allowance:      food,
    other_allowances:    other,
    // gross_salary in formula = basic component only (not incl. allowances) so formula math adds correctly
    gross_salary:        basicPro + otAmt + (Number(row.bonus) || 0),
    total_allowances:    housing + transport + food + other,
    days_in_month:       dim,
    working_days:        settings?.working_days_per_month || 26,
    daily_rate:          basic / (dim || 1),
    hourly_rate:         basic / ((dim || 1) * 8),
    ot_hours:            Number(row.overtime_hours) || 0,
    leave_days:          Number(row.leave_days) || 0,
    gosi_employee:       gosiEmp,
    gosi_employer:       gosiEr,
    total_deductions:    totalDed,
  };
}

function recompute(row, settings, dim, calcFormulas = {}, statutory = null) {
  const otRate = settings?.ot_rate_normal != null ? Number(settings.ot_rate_normal) : 1.25;

  const basic  = Number(row.basic_salary) || 0;
  const dw     = Number(row.days_worked) >= 0 ? Number(row.days_worked) : dim;
  const ld     = Number(row.leave_days) || 0;
  const absent = Math.max(0, dim - dw - ld);
  // Basic Salary always shows the full contracted amount; the monetary
  // value of days not worked (unpaid leave, manual absence adjustment)
  // is broken out as its own "Leave Ded." line instead of silently
  // shrinking the Basic figure — same net pay, but auditable.
  const basicPro = basic;
  const leaveDeduction = dw < dim ? r3((basic / dim) * (dim - dw)) : 0;
  const housing   = Number(row.housing_allowance) || 0;
  const transport = Number(row.transport_allowance) || 0;
  const food      = Number(row.food_allowance) || 0;
  const other     = Number(row.other_allowances) || 0;
  const otH       = Number(row.overtime_hours) || 0;
  const hourly    = basic / ((dim || 1) * 8);
  const otAmt     = r3(hourly * otH * otRate);
  const bonus     = Number(row.bonus) || 0;
  const gross     = r3(basicPro + housing + transport + food + other + otAmt + bonus);

  // Statutory deductions/contributions:
  // - Bahrain (or no statutory context) keeps the legacy payroll_settings
  //   GOSI path so existing tenants see identical numbers.
  // - Other countries run the country statutory engine (GOSI/GPSSA/PASI/
  //   PIFSS/PF/ESI/PT/TDS/PAYE/NI/pension/FICA/state taxes) with rates
  //   from country_statutory_rules and tax_rules.
  let gosiEmp, gosiEr, statutoryBreakdown = null, statutoryWageBases = {};
  if (statutory && statutory.countryCode && statutory.countryCode !== 'BH') {
    // YTD balances (cumulative amounts *before* this period) let GB PAYE run
    // its real cumulative method and US FICA cap the SS wage base against
    // actual year-to-date wages instead of a monthly average.
    const empYtd = statutory.ytdBalances?.[row.employee_id];
    // Per-employee tax profile (tax code, W-4 details, PT state, tax
    // regime, nationality class...) collected on the employee record —
    // see TAX_PROFILE_FIELDS in usePayroll.js. Falls back to country-level
    // defaults inside each calculator when an employee hasn't filled a
    // field in yet (e.g. a brand new GB tax code defaults to 1257L).
    const taxProfile = statutory.taxProfiles?.[row.employee_id] || {};
    const res = computeStatutory({
      countryCode: statutory.countryCode,
      nationality: row.nationality,
      socialBase: basic,
      gross,
      monthlyTaxable: gross,
      ruleRows: statutory.ruleRows || [],
      taxRules: statutory.taxRules || [],
      ...taxProfile,
      monthsElapsed: statutory.monthsElapsed,
      monthsRemaining: statutory.monthsRemaining,
      ytd: empYtd ? {
        grossToDate: empYtd.GROSS || 0,
        taxableToDate: empYtd.GROSS || 0,
        tdsToDate: empYtd.TDS || 0,
        payeToDate: empYtd.PAYE || 0,
        ssWagesToDate: empYtd.SS_WAGES || 0,
        medicareWagesToDate: empYtd.GROSS || 0,
      } : undefined,
    });
    gosiEmp = r3(res.employee);
    gosiEr  = r3(res.employer);
    statutoryBreakdown = res.breakdown;
    statutoryWageBases = res.wageBases || {};
  } else {
    const isBahraini = (row.nationality || '').toLowerCase() === 'bahraini';
    const pct = (val, def) => (val != null && val !== '' ? Number(val) : def) / 100;
    const empPct = isBahraini ? pct(settings?.bahraini_employee_gosi_pct, 8) : pct(settings?.expat_employee_gosi_pct, 1);
    const erPct  = isBahraini ? pct(settings?.bahraini_employer_gosi_pct, 13) : pct(settings?.expat_employer_gosi_pct, 3);
    gosiEmp = r3(basic * empPct);
    gosiEr  = r3(basic * erPct);
  }
  const loan      = Number(row.loan_deduction) || 0;
  const otherDed  = Number(row.other_deductions) || 0;
  const totalDed  = r3(gosiEmp + loan + otherDed + leaveDeduction);

  // ── Formula-based LEAVE_PAY ─────────────────────────────────────────────────
  let leavePay = 0;
  if (calcFormulas['LEAVE_PAY'] && ld > 0) {
    const ctx = buildFormulaContext(row, settings, dim, gosiEmp, gosiEr, otAmt, basicPro, gross, totalDed);
    leavePay = r3(evaluateFormula(calcFormulas['LEAVE_PAY'], ctx) || 0);
  }

  // ── Formula-based NET_SALARY (with LEAVE_PAY substituted in) ────────────────
  let net;
  if (calcFormulas['NET_SALARY']) {
    const ctx = buildFormulaContext(row, settings, dim, gosiEmp, gosiEr, otAmt, basicPro, gross, totalDed);
    ctx.LEAVE_PAY = leavePay;
    ctx.leave_pay = leavePay;
    ctx.leave_salary = leavePay;
    net = r3(evaluateFormula(calcFormulas['NET_SALARY'], ctx) || 0);
  } else {
    net = r3(gross + leavePay - totalDed);
  }

  return {
    ...row,
    days_worked: dw,
    leave_days: ld,
    absent_days: absent,
    overtime_amount: otAmt,
    gross_salary: gross,
    gosi_employee: gosiEmp,
    gosi_employer: gosiEr,
    leave_deduction: leaveDeduction,
    total_deductions: totalDed,
    net_salary: net,
    // Non-persisted metadata carried through for YTD posting at approval
    // time (see PayrollPage.jsx buildYtdUpdates) — not a payroll_line_items column.
    _statutoryBreakdown: statutoryBreakdown,
    _statutoryWageBases: statutoryWageBases,
  };
}

function makeRowFromEmployee(emp, dim, leaveMap = {}, hasLeaveFormula = false) {
  const leaveInfo = leaveMap[emp.id] || { days: 0, unpaidDays: 0 };
  const leaveDays = leaveInfo.days || 0;
  // Formula mode: days_worked = actual worked days (excl. all leave).
  // LEAVE_PAY formula then adds back pay for paid leave days.
  // Fallback mode: only unpaid leave reduces days_worked.
  const daysWorked = hasLeaveFormula
    ? Math.max(0, dim - leaveDays)
    : Math.max(0, dim - (leaveInfo.unpaidDays || 0));
  return {
    employee_id: emp.id,
    first_name: emp.first_name || '',
    last_name: emp.last_name || '',
    employee_number: emp.employee_id || '',
    nationality: emp.nationality || '',
    department: emp.departments?.name || emp.department || '–',
    basic_salary: emp.basic_salary || 0,
    housing_allowance: emp.housing_allowance || 0,
    transport_allowance: emp.transport_allowance || 0,
    food_allowance: emp.food_allowance || 0,
    other_allowances: emp.other_allowances || 0,
    overtime_hours: 0,
    bonus: 0,
    loan_deduction: 0,
    other_deductions: 0,
    leave_days: leaveDays,
    days_worked: daysWorked,
    included: true,
  };
}

function makeRowFromItem(item, dim) {
  return {
    id: item.id,
    employee_id: item.employee_id,
    first_name: item.employees?.first_name || '',
    last_name: item.employees?.last_name || '',
    employee_number: item.employees?.employee_id || '',
    nationality: item.employees?.nationality || '',
    department: '–',
    basic_salary: item.basic_salary || 0,
    housing_allowance: item.housing_allowance || 0,
    transport_allowance: item.transport_allowance || 0,
    food_allowance: item.food_allowance || 0,
    other_allowances: item.other_allowances || 0,
    overtime_hours: item.overtime_hours || 0,
    overtime_amount: item.overtime_amount || 0,
    bonus: item.bonus || 0,
    loan_deduction: item.loan_deduction || 0,
    other_deductions: item.other_deductions || 0,
    leave_deduction: item.leave_deduction || 0,
    leave_days: item.leave_days || 0,
    days_worked: item.working_days != null ? item.working_days : dim,
    absent_days: item.absent_days || 0,
    gross_salary: item.gross_salary || 0,
    gosi_employee: item.gosi_employee || 0,
    gosi_employer: item.gosi_employer || 0,
    total_deductions: item.total_deductions || 0,
    net_salary: item.net_salary || 0,
    included: true,
  };
}

// Column definitions
const COLS = [
  // Attendance
  { key: 'days_in_month', label: 'Days/Mo', group: 'attendance', w: 66, editable: false },
  { key: 'days_worked', label: 'Worked', group: 'attendance', w: 72, editable: true, int: true },
  { key: 'leave_days', label: 'Leave', group: 'attendance', w: 62, editable: true },
  // Earnings
  { key: 'basic_salary', label: 'Basic', group: 'earnings', w: 96, editable: true },
  { key: 'housing_allowance', label: 'Housing', group: 'earnings', w: 88, editable: true },
  { key: 'transport_allowance', label: 'Transport', group: 'earnings', w: 88, editable: true },
  { key: 'food_allowance', label: 'Food', group: 'earnings', w: 80, editable: true },
  { key: 'other_allowances', label: 'Other Allow.', group: 'earnings', w: 90, editable: true },
  { key: 'overtime_hours', label: 'OT Hrs', group: 'earnings', w: 68, editable: true },
  { key: 'overtime_amount', label: 'OT Amt', group: 'earnings', w: 88, editable: false },
  { key: 'bonus', label: 'Bonus', group: 'earnings', w: 88, editable: true },
  { key: 'gross_salary', label: 'Gross', group: 'gross', w: 104, editable: false, bold: true },
  // GOSI
  { key: 'gosi_employee', label: 'GOSI Emp', group: 'gosi', w: 90, editable: false },
  { key: 'gosi_employer', label: 'GOSI Er.', group: 'gosi', w: 90, editable: false },
  // Deductions
  { key: 'leave_deduction', label: 'Leave Ded.', group: 'deductions', w: 90, editable: false },
  { key: 'loan_deduction', label: 'Loan Ded.', group: 'deductions', w: 90, editable: true },
  { key: 'other_deductions', label: 'Other Ded.', group: 'deductions', w: 90, editable: true },
  { key: 'total_deductions', label: 'Total Ded.', group: 'deductions', w: 96, editable: false, bold: true },
  // Net
  { key: 'net_salary', label: 'Net Pay', group: 'net', w: 108, editable: false, bold: true },
];

const GROUP_META = {
  attendance:  { label: 'Attendance',  cls: 'bg-sky-50 text-sky-700 border-sky-200', hdr: 'bg-sky-50/60' },
  earnings:    { label: 'Earnings',    cls: 'bg-green-50 text-green-700 border-green-200', hdr: 'bg-green-50/60' },
  gross:       { label: 'Gross',       cls: 'bg-green-100 text-green-800 border-green-300', hdr: 'bg-green-100/60' },
  gosi:        { label: 'GOSI',        cls: 'bg-orange-50 text-orange-700 border-orange-200', hdr: 'bg-orange-50/60' },
  deductions:  { label: 'Deductions',  cls: 'bg-red-50 text-red-700 border-red-200', hdr: 'bg-red-50/60' },
  net:         { label: 'Net Pay',     cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold', hdr: 'bg-emerald-100/60' },
};

// Consecutive group spans for the header row
function colGroupSpans() {
  const spans = [];
  let cur = null;
  COLS.forEach(c => {
    if (cur && cur.group === c.group) { cur.span++; }
    else { cur = { group: c.group, span: 1 }; spans.push(cur); }
  });
  return spans;
}
const GROUP_SPANS = colGroupSpans();

function fmtNum(v, col) {
  if (col.key === 'days_in_month') return v;
  if (col.key === 'days_worked' || col.key === 'overtime_hours') return v != null ? Number(v).toFixed(0) : '–';
  if (col.key === 'leave_days') return v != null ? Number(v).toFixed(1) : '–';
  return v != null && !isNaN(v) ? Number(v).toFixed(3) : '–';
}

const PayrollBulkGrid = forwardRef(function PayrollBulkGrid({ employees = [], availableEmployees, settings = {}, leaveMap = {}, calcFormulas = {}, statutory = null, month, year, existingItems, readOnly = false }, ref) {
  const dim = getDaysInMonth(new Date(year, month - 1, 1));
  const hasLeaveFormula = !!calcFormulas['LEAVE_PAY'];

  const [rows, setRows] = useState(() => {
    if (existingItems?.length) return existingItems.map(item => recompute(makeRowFromItem(item, dim), settings, dim, calcFormulas, statutory));
    return employees.map(emp => recompute(makeRowFromEmployee(emp, dim, leaveMap, hasLeaveFormula), settings, dim, calcFormulas, statutory));
  });

  // Re-run GOSI/OT calculations whenever settings finish loading from the server
  const prevSettingsRef = useRef(settings);
  useEffect(() => {
    const prev = prevSettingsRef.current;
    const changed =
      prev?.expat_employee_gosi_pct !== settings?.expat_employee_gosi_pct ||
      prev?.expat_employer_gosi_pct !== settings?.expat_employer_gosi_pct ||
      prev?.bahraini_employee_gosi_pct !== settings?.bahraini_employee_gosi_pct ||
      prev?.bahraini_employer_gosi_pct !== settings?.bahraini_employer_gosi_pct ||
      prev?.ot_rate_normal !== settings?.ot_rate_normal;
    if (changed) {
      setRows(prev => prev.map(row => recompute(row, settings, dim, calcFormulas, statutory)));
      prevSettingsRef.current = settings;
    }
  }, [settings, dim]);

  useImperativeHandle(ref, () => ({
    getRows: () => rows.filter(r => r.included !== false),
    addEmployee: (emp) => setRows(prev => {
      if (prev.find(r => r.employee_id === emp.id)) return prev;
      return [...prev, recompute(makeRowFromEmployee(emp, dim, leaveMap, hasLeaveFormula), settings, dim, calcFormulas, statutory)];
    }),
    removeRow: (employeeId) => setRows(prev => prev.filter(r => r.employee_id !== employeeId)),
    syncLeave: (newLeaveMap) => setRows(prev => prev.map(row => {
      const info = newLeaveMap[row.employee_id] || { days: 0, unpaidDays: 0 };
      const leaveDays = info.days || 0;
      const daysWorked = hasLeaveFormula
        ? Math.max(0, dim - leaveDays)
        : Math.max(0, dim - (info.unpaidDays || 0));
      return recompute({ ...row, leave_days: leaveDays, days_worked: daysWorked }, settings, dim, calcFormulas, statutory);
    })),
  }));

  const updateField = (idx, key, rawVal) => {
    setRows(prev => {
      const copy = [...prev];
      let val = key === 'days_worked'
        ? Math.max(0, Math.min(dim, Number(rawVal) || 0))
        : Number(rawVal) || 0;
      copy[idx] = recompute({ ...copy[idx], [key]: val }, settings, dim, calcFormulas, statutory);
      return copy;
    });
  };

  const toggleIncluded = (idx) => setRows(prev => {
    const copy = [...prev];
    copy[idx] = { ...copy[idx], included: copy[idx].included === false };
    return copy;
  });

  const includedRows = rows.filter(r => r.included !== false);
  const allIncluded = rows.length > 0 && includedRows.length === rows.length;
  const toggleAll = () => setRows(prev => prev.map(r => ({ ...r, included: !allIncluded })));

  const totals = useMemo(() => COLS.reduce((acc, col) => {
    const skip = ['days_in_month', 'days_worked', 'overtime_hours', 'leave_days'];
    if (!skip.includes(col.key)) acc[col.key] = r3(includedRows.reduce((s, r) => s + (Number(r[col.key]) || 0), 0));
    return acc;
  }, {}), [rows]);

  const empInGrid = new Set(rows.map(r => r.employee_id));
  const availableToAdd = (availableEmployees ?? employees).filter(e => !empInGrid.has(e.id));

  return (
    <div className="flex flex-col gap-2">
      {/* Summary banner */}
      <div className="flex flex-wrap gap-4 px-1 text-sm">
        <span className="text-secondary-500">
          <strong className="text-secondary-800">{MONTHS[month - 1]} {year}</strong>
          {' · '}{includedRows.length < rows.length
            ? `${includedRows.length} of ${rows.length} employees selected`
            : `${rows.length} employees`}
          {' · '}{dim} days
        </span>
        <span className="text-green-700 font-mono font-semibold">Gross: {Number(totals.gross_salary || 0).toFixed(3)}</span>
        <span className="text-red-600 font-mono">Deductions: {Number(totals.total_deductions || 0).toFixed(3)}</span>
        <span className="text-emerald-700 font-mono font-bold">Net: {Number(totals.net_salary || 0).toFixed(3)}</span>
      </div>

      {/* Individual mode: add employee */}
      {!readOnly && availableToAdd.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="input text-sm flex-1 max-w-xs"
            defaultValue=""
            onChange={e => {
              const emp = availableToAdd.find(a => a.id === e.target.value);
              if (emp) {
                setRows(prev => {
                  if (prev.find(r => r.employee_id === emp.id)) return prev;
                  return [...prev, recompute(makeRowFromEmployee(emp, dim, leaveMap, hasLeaveFormula), settings, dim, calcFormulas, statutory)];
                });
                e.target.value = '';
              }
            }}
          >
            <option value="">+ Add employee to this run…</option>
            {availableToAdd.map(e => (
              <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>
            ))}
          </select>
          <span className="text-xs text-secondary-400">{availableToAdd.length} employees not yet in this run</span>
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-secondary-200 shadow-sm" style={{ maxHeight: '65vh' }}>
        <table className="text-xs border-collapse" style={{ minWidth: 1620 }}>
          <thead className="sticky top-0 z-20">
            {/* Group header row */}
            <tr>
              <th className="sticky left-0 z-30 bg-secondary-200 border border-secondary-300 px-3 py-1.5 text-left text-secondary-500 font-semibold" colSpan={readOnly ? 2 : 3}></th>
              {GROUP_SPANS.map(({ group, span }) => {
                const meta = GROUP_META[group];
                return (
                  <th key={group} className={`border ${meta.cls} px-2 py-1.5 text-center font-semibold text-xs`} colSpan={span}>
                    {meta.label}
                  </th>
                );
              })}
            </tr>
            {/* Column header row */}
            <tr>
              {!readOnly && (
                <th className="sticky left-0 z-30 bg-secondary-100 border border-secondary-200 px-2 py-1.5 text-center" style={{ minWidth: 36 }}>
                  <input type="checkbox" checked={allIncluded} onChange={toggleAll} title="Select / deselect all" />
                </th>
              )}
              <th className="sticky z-30 bg-secondary-100 border border-secondary-200 px-3 py-1.5 text-left text-secondary-600 font-semibold whitespace-nowrap" style={{ minWidth: 180, left: readOnly ? 0 : 36 }}>Employee</th>
              <th className="bg-secondary-100 border border-secondary-200 px-2 py-1.5 text-center text-secondary-500 font-medium whitespace-nowrap" style={{ minWidth: 55 }}>Nat.</th>
              {COLS.map(col => {
                const meta = GROUP_META[col.group];
                return (
                  <th key={col.key} className={`border border-secondary-200 px-2 py-1.5 text-right text-secondary-600 font-semibold whitespace-nowrap ${meta.hdr}`} style={{ minWidth: col.w }}>
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => (
              <tr key={row.employee_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-secondary-50/40'} hover:bg-primary-50/20 transition-colors ${row.included === false ? 'opacity-40' : ''}`}>
                {/* Include/exclude toggle */}
                {!readOnly && (
                  <td className="sticky left-0 z-10 bg-inherit border border-secondary-200 px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={row.included !== false}
                      onChange={() => toggleIncluded(i)}
                      title="Include this employee in the save"
                    />
                  </td>
                )}
                {/* Sticky employee name */}
                <td className="sticky z-10 bg-inherit border border-secondary-200 px-3 py-1 whitespace-nowrap" style={{ left: readOnly ? 0 : 36 }}>
                  <p className="font-medium text-secondary-800 text-xs">{row.first_name} {row.last_name}</p>
                  <p className="text-[10px] text-secondary-400">{row.employee_number}</p>
                </td>
                {/* Nationality badge */}
                <td className="border border-secondary-200 px-2 py-1 text-center">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${(row.nationality || '').toLowerCase() === 'bahraini' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {(row.nationality || 'N/A').slice(0, 3).toUpperCase()}
                  </span>
                </td>
                {/* Data cells */}
                {COLS.map(col => {
                  const meta = GROUP_META[col.group];
                  const val = col.key === 'days_in_month' ? dim : row[col.key];
                  return (
                    <td key={col.key} className={`border border-secondary-200 px-0.5 py-0.5 ${meta.hdr} ${col.bold ? 'font-bold' : ''}`} style={{ minWidth: col.w }}>
                      {col.editable && !readOnly ? (
                        <input
                          type="number"
                          step={col.int ? '1' : '0.001'}
                          min="0"
                          value={val === 0 ? '' : val}
                          placeholder="0"
                          onChange={e => updateField(i, col.key, e.target.value)}
                          className="w-full text-right font-mono text-xs py-1 px-1.5 bg-transparent border border-transparent hover:border-secondary-300 focus:border-primary-400 focus:outline-none focus:bg-white rounded"
                        />
                      ) : (
                        <span className="block text-right font-mono text-xs px-2 py-1">{fmtNum(val, col)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length + (readOnly ? 2 : 3)} className="py-12 text-center text-secondary-400 text-sm">
                  No employees in this run. Use the dropdown above to add employees.
                </td>
              </tr>
            )}
          </tbody>

          {/* Totals footer */}
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-20">
              <tr className="bg-secondary-100 font-bold">
                <td className="sticky left-0 z-30 bg-secondary-100 border border-secondary-200 px-3 py-1.5 text-secondary-700 text-xs whitespace-nowrap" colSpan={readOnly ? 2 : 3}>
                  Totals ({includedRows.length} emp.)
                </td>
                {COLS.map(col => {
                  const meta = GROUP_META[col.group];
                  const skip = ['days_in_month', 'days_worked', 'overtime_hours', 'leave_days'];
                  const v = skip.includes(col.key) ? '' : totals[col.key] != null ? Number(totals[col.key]).toFixed(3) : '';
                  return (
                    <td key={col.key} className={`border border-secondary-200 px-2 py-1.5 text-right font-mono text-xs ${meta.hdr} ${col.key === 'net_salary' ? 'text-emerald-800' : col.key === 'total_deductions' ? 'text-red-700' : ''}`} style={{ minWidth: col.w }}>
                      {v}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

export default PayrollBulkGrid;
export { recompute, makeRowFromEmployee };
