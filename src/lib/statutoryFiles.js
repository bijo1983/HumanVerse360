// ============================================================
// Statutory compliance file generation (Phase 9b)
//
// Produces the text files banks/authorities expect as INPUT to their own
// systems — this module only generates file content locally; it does not
// submit anything to a government or bank API (that integration is a
// separate, deliberately out-of-scope roadmap item — see the blueprint's
// migration/security doc, "compliance outputs" section).
//
// Every format below is a widely-published, stable public specification.
// Still: WPS is bank-agent-mediated (Central Bank / MOHRE / LMRA route the
// file through your company's onboarded WPS agent bank), and some agents
// customize trailing fields or codes. Confirm the exact column order and
// employer/agent codes with your bank's WPS onboarding team before the
// first live submission. The India PF ECR layout is the stable, unchanged
// EPFO v2.0 specification and needs no such per-bank verification.
// ============================================================

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

function money(v, decimals = 2) {
  return (Number(v) || 0).toFixed(decimals);
}

function csvField(v) {
  // WPS SIF is comma-delimited; strip commas/newlines from free-text fields
  // (names, employer name) so a stray comma can't shift the record layout.
  return String(v ?? '').replace(/[,\r\n]/g, ' ').trim();
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// WPS SIF (UAE Central Bank / MOHRE, and Bahrain LMRA/CBB) —
// standard EDR (employer) + SCR (salary/employee) record layout.
// ------------------------------------------------------------
// employerSettings: { wpsEstablishmentId, bankShortName, employerAccountOrIban }
// employeeInfo: { [employee_id]: { wpsPersonId, bankAgentId, accountOrIban } }
export function generateWpsSif({ run, items, employerSettings, employeeInfo, currencyCode, currencyDecimals = 2 }) {
  const missing = items.filter(i => !employeeInfo[i.employee_id]?.wpsPersonId || !employeeInfo[i.employee_id]?.accountOrIban);

  const scrLines = items.map(item => {
    const info = employeeInfo[item.employee_id] || {};
    const variableAdditions = (item.housing_allowance || 0) + (item.transport_allowance || 0)
      + (item.food_allowance || 0) + (item.other_allowances || 0) + (item.overtime_amount || 0) + (item.bonus || 0);
    const variableDeductions = (item.loan_deduction || 0) + (item.other_deductions || 0);
    return [
      'SCR',
      csvField(employerSettings.wpsEstablishmentId),
      csvField(info.wpsPersonId || ''),
      csvField(info.accountOrIban || ''),
      csvField(info.bankAgentId || employerSettings.bankShortName || ''),
      'M', // salary frequency: Monthly
      item.working_days ?? '',
      item.leave_days ?? 0,
      money(item.basic_salary, currencyDecimals),
      money(variableAdditions, currencyDecimals),
      money(variableDeductions, currencyDecimals),
      money(item.net_salary, currencyDecimals),
    ].join(',');
  });

  const totalNet = items.reduce((s, i) => s + (Number(i.net_salary) || 0), 0);
  const edrLine = [
    'EDR',
    csvField(employerSettings.wpsEstablishmentId),
    csvField(employerSettings.employerName),
    csvField(employerSettings.bankShortName),
    csvField(employerSettings.employerAccountOrIban),
    run.year,
    pad(run.month),
    money(totalNet, currencyDecimals),
    items.length,
    currencyCode,
  ].join(',');

  const content = [edrLine, ...scrLines].join('\r\n') + '\r\n';
  const filename = `WPS_SIF_${run.year}${pad(run.month)}.sif`;
  return { filename, content, warnings: missing.map(i => `Missing WPS person ID or account/IBAN for employee ${i.employee_id}`) };
}

// ------------------------------------------------------------
// India EPFO ECR (Electronic Challan cum Return) — stable v2.0 text
// format, '#~#'-delimited, one line per employee.
// ------------------------------------------------------------
// pfRules: { employeePct, epsPct, wageCap } resolved from
// country_statutory_rules for the PF module at the run's period. epsPct
// (8.33%) is a fixed statutory sub-split of the employer's 12% (EPF
// Scheme para 3) rather than its own configurable rate row, so callers
// typically pass the statutory default unless a company has a documented
// override.
// employeeInfo: { [employee_id]: { uan, name } }
export function generatePfEcr({ run, items, employeeInfo, pfRules }) {
  const { employeePct = 0.12, epsPct = 0.0833, wageCap = 15000 } = pfRules || {};
  const missing = items.filter(i => !employeeInfo[i.employee_id]?.uan);

  const lines = items.map(item => {
    const info = employeeInfo[item.employee_id] || {};
    const grossWages = Number(item.gross_salary) || 0;
    const pfWages = Math.min(Number(item.basic_salary) || 0, wageCap);
    const epsWages = pfWages;
    const edliWages = pfWages;
    const epsContri = Math.round(epsWages * epsPct);
    const employeeContri = Math.round(pfWages * employeePct);
    const employerPfContri = Math.max(0, employeeContri - epsContri); // employer's non-EPS EPF share
    const epfEpsDiff = 0; // arrears/adjustment — not tracked separately
    const ncpDays = Math.round(item.absent_days || 0); // non-contributing period days
    const refundOfAdvances = 0;
    return [
      info.uan || '',
      csvField(info.name || `${item.employees?.first_name || ''} ${item.employees?.last_name || ''}`.trim()),
      Math.round(grossWages),
      Math.round(pfWages),
      Math.round(epsWages),
      Math.round(edliWages),
      employerPfContri,
      epsContri,
      epfEpsDiff,
      ncpDays,
      refundOfAdvances,
      '', // trailing delimiter per the official ECR text layout
    ].join('#~#');
  });

  const content = lines.join('\r\n') + '\r\n';
  const filename = `PF_ECR_${run.year}${pad(run.month)}.txt`;
  return { filename, content, warnings: missing.map(i => `Missing UAN for employee ${i.employee_id}`) };
}

export { downloadTextFile };
