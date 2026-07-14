import { differenceInDays, differenceInMonths, differenceInYears, parseISO, getDaysInMonth } from 'date-fns';

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

// Returns actual calendar days in the given month. date can be a Date or {year, month} (1-based month).
export function getCalendarDaysInMonth(date) {
  const d = date instanceof Date ? date : new Date(date.year, date.month - 1, 1);
  return getDaysInMonth(d);
}

// Daily rate using actual calendar days of the reference month.
// If no date provided, uses 30 as the Bahrain Labour Law standard for indemnity purposes.
export function calculateDailyRate(salary, referenceDate) {
  const days = referenceDate ? getCalendarDaysInMonth(referenceDate) : 30;
  return salary / days;
}

export function calculateIndemnity(basicSalary, joiningDate, endDate, terminationType = 'Termination') {
  const totalMonths = getServiceMonths(joiningDate, endDate);
  const totalYears = totalMonths / 12;
  // BH Labour Law Art. 116 uses 30-day month standard for daily rate
  const dailyRate = basicSalary / 30;

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

export function calculateOvertimePay(basicSalary, overtimeHours, isHoliday = false, referenceDate) {
  const daysInMonth = referenceDate ? getCalendarDaysInMonth(referenceDate) : 30;
  const hourlyRate = basicSalary / (daysInMonth * 8);
  const multiplier = isHoliday ? 1.5 : 1.25;
  return hourlyRate * overtimeHours * multiplier;
}

// Bahraini GOSI rates (SIO – Social Insurance Organisation)
// Pension: Employee 7% + Employer 12% | Unemployment: Employee 1% + Employer 1%
export function calculateGOSIBahraini(basicSalary, type = 'employee') {
  if (type === 'employee') return basicSalary * 0.08; // 7% pension + 1% unemployment
  return basicSalary * 0.13; // 12% pension + 1% unemployment
}

// Expat GOSI rates (Work Injury Insurance only)
// Employee 1% + Employer 3%
export function calculateGOSIExpat(basicSalary, type = 'employee') {
  return basicSalary * (type === 'employee' ? 0.01 : 0.03);
}

// Unified GOSI entry point – nationality: 'Bahraini' | 'Expat'
export function calculateGOSI(basicSalary, type = 'employee', nationality = 'Bahraini') {
  if (nationality === 'Bahraini') return calculateGOSIBahraini(basicSalary, type);
  return calculateGOSIExpat(basicSalary, type);
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

// Legacy signature kept for existing call sites (defaults preserve the
// original Bahrain behavior). New code should pass a locale config from
// useCountryConfig(): formatCurrency(amount, cfg.locale)
export function formatCurrency(amount, currencyOrLocale = 'BHD') {
  if (amount == null || isNaN(amount)) return '–';
  const locale =
    typeof currencyOrLocale === 'string'
      ? { currencyCode: currencyOrLocale, currencyDecimals: currencyOrLocale === 'BHD' ? 3 : 2, numberLocale: 'en-BH' }
      : currencyOrLocale;
  return new Intl.NumberFormat(locale.numberLocale || 'en', {
    style: 'currency',
    currency: locale.currencyCode || 'BHD',
    minimumFractionDigits: locale.currencyDecimals ?? 2,
    maximumFractionDigits: locale.currencyDecimals ?? 2,
  }).format(amount);
}

export function formatDate(date, localeCfg) {
  if (!date) return '–';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (localeCfg?.dateFormat === 'MM/DD/YYYY') {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(d);
  }
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  return differenceInDays(
    typeof expiryDate === 'string' ? parseISO(expiryDate) : expiryDate,
    new Date()
  );
}
