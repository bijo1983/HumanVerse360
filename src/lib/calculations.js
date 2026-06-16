import { differenceInDays, differenceInMonths, differenceInYears, parseISO } from 'date-fns';

export function getServiceYears(joiningDate, endDate = new Date()) {
  const start = typeof joiningDate === 'string' ? parseISO(joiningDate) : joiningDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  return differenceInYears(end, start);
}

export function getServiceMonths(joiningDate, endDate = new Date()) {
  const start = typeof joiningDate === 'string' ? parseISO(joiningDate) : joiningDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  return differenceInMonths(end, start);
}

export function getServiceDays(joiningDate, endDate = new Date()) {
  const start = typeof joiningDate === 'string' ? parseISO(joiningDate) : joiningDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  return differenceInDays(end, start);
}

export function calculateIndemnity(basicSalary, joiningDate, endDate, terminationType = 'Termination') {
  const totalMonths = getServiceMonths(joiningDate, endDate);
  const totalYears = totalMonths / 12;
  const dailyRate = basicSalary / 26;

  if (totalYears < 1) return { amount: 0, breakdown: 'Less than 1 year – no indemnity' };

  let indemnity = 0;
  let breakdown = '';

  const factor = terminationType === 'Resignation'
    ? (totalYears < 3 ? 1/3 : totalYears < 5 ? 2/3 : 1)
    : 1;

  if (totalYears <= 3) {
    indemnity = dailyRate * 15 * totalYears * factor;
    breakdown = `${totalYears.toFixed(2)} yrs × 15 days × ${factor === 1 ? 'full' : (factor * 100).toFixed(0) + '%'}`;
  } else {
    const first3 = dailyRate * 15 * 3;
    const remaining = (basicSalary / 30) * (totalYears - 3);
    indemnity = (first3 + remaining) * factor;
    breakdown = `3 yrs (15d/yr) + ${(totalYears - 3).toFixed(2)} yrs (30d/yr) × ${factor === 1 ? 'full' : (factor * 100).toFixed(0) + '%'}`;
  }

  return { amount: Math.round(indemnity * 1000) / 1000, breakdown };
}

export function calculateAnnualLeaveAccrual(joiningDate, asOfDate = new Date()) {
  const months = getServiceMonths(joiningDate, asOfDate);
  const cappedMonths = Math.min(months, 12);
  return (cappedMonths / 12) * 30;
}

export function calculateOvertimePay(basicSalary, overtimeHours, isHoliday = false) {
  const hourlyRate = basicSalary / (26 * 8);
  const multiplier = isHoliday ? 1.5 : 1.25;
  return hourlyRate * overtimeHours * multiplier;
}

export function calculateGOSI(basicSalary, type = 'employee') {
  const rate = type === 'employee' ? 0.07 : 0.12;
  return basicSalary * rate;
}

export function calculateDailyRate(grossSalary, workingDays = 26) {
  return grossSalary / workingDays;
}

export function getDocumentStatus(expiryDate) {
  if (!expiryDate) return 'no-expiry';
  const days = differenceInDays(
    typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate,
    new Date()
  );
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 60) return 'warning';
  if (days <= 90) return 'alert';
  return 'valid';
}

export function getDocumentStatusLabel(expiryDate) {
  const status = getDocumentStatus(expiryDate);
  const labels = { expired: 'Expired', critical: 'Critical', warning: 'Warning', alert: 'Alert', valid: 'Valid', 'no-expiry': 'No Expiry' };
  return labels[status];
}

export function evaluateFormula(formula, variables) {
  try {
    const keys = Object.keys(variables);
    const vals = Object.values(variables);
    const fn = new Function(...keys, `return ${formula}`);
    const result = fn(...vals);
    return typeof result === 'number' ? Math.round(result * 1000) / 1000 : result;
  } catch {
    return null;
  }
}

export function formatCurrency(amount, currency = 'BHD') {
  if (amount == null || isNaN(amount)) return '–';
  return new Intl.NumberFormat('en-BH', { style: 'currency', currency, minimumFractionDigits: 3 }).format(amount);
}

export function formatDate(date) {
  if (!date) return '–';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  return differenceInDays(
    typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate,
    new Date()
  );
}
