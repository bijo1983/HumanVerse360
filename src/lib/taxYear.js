// ============================================================
// Tax year resolution per country (Phase 9a)
// ============================================================
// GB: 6 Apr – 5 Apr | IN: 1 Apr – 31 Mar (fiscal year) | US/GCC: calendar year

const TAX_YEAR_START = {
  GB: { month: 4, day: 6 },
  IN: { month: 4, day: 1 },
};

function defaultStart() {
  return { month: 1, day: 1 };
}

// Returns { label, startDate, endDate, monthsElapsed, monthsRemaining }
// for the tax year containing `periodEndDate`.
export function resolveTaxYear(countryCode, periodEndDate) {
  const d = periodEndDate instanceof Date ? periodEndDate : new Date(periodEndDate);
  const { month, day } = TAX_YEAR_START[countryCode] || defaultStart();

  let startYear = d.getFullYear();
  const thisYearStart = new Date(d.getFullYear(), month - 1, day);
  if (d < thisYearStart) startYear -= 1;

  const startDate = new Date(startYear, month - 1, day);
  const endDate = new Date(startYear + 1, month - 1, day - 1);

  const monthsElapsed = Math.max(
    1,
    (d.getFullYear() - startDate.getFullYear()) * 12 + (d.getMonth() - startDate.getMonth()) + 1
  );
  const monthsRemaining = Math.max(1, 12 - monthsElapsed + 1);

  let label;
  if (countryCode === 'IN') label = `FY${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  else if (countryCode === 'GB') label = `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
  else label = String(startYear);

  return { label, startDate, endDate, monthsElapsed, monthsRemaining };
}
