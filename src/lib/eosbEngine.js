// ============================================================
// Generic EOSB / gratuity / indemnity band engine (Phase 6)
//
// One algorithm serves every country; the differences live in
// eosb_rules rows: tier bands (days of pay per year of service by
// service range), termination-reason factors, day divisor (30 GCC /
// 26 IN), eligibility, year rounding and caps.
// ============================================================

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

// Years of service between two dates (fractional)
export function serviceYears(joiningDate, endDate = new Date()) {
  const start = new Date(joiningDate);
  const end = new Date(endDate);
  return Math.max(0, (end.getTime() - start.getTime()) / 86400000 / 365.25);
}

function yearsWithinBand(totalYears, band) {
  const from = num(band.fromYears, 0);
  const to = band.toYears == null ? Infinity : num(band.toYears);
  return Math.max(0, Math.min(totalYears, to) - from);
}

function factorFor(terminationFactors = [], reason, totalYears) {
  if (!Array.isArray(terminationFactors) || terminationFactors.length === 0) return 1;
  const entry =
    terminationFactors.find(f => f.reason?.toLowerCase() === String(reason || '').toLowerCase()) ??
    terminationFactors.find(f => f.reason === 'Any');
  if (!entry) return 1;
  if (entry.factor != null) return num(entry.factor, 1);
  if (Array.isArray(entry.byService)) {
    for (const b of entry.byService) {
      const from = num(b.fromYears, 0);
      const to = b.toYears == null ? Infinity : num(b.toYears);
      if (totalYears >= from && totalYears < to) return num(b.factor, 1);
    }
  }
  return 1;
}

// rule: an eosb_rules row. input: { baseSalary, joiningDate, endDate,
//        terminationReason, isCitizen, currencyDecimals }
// Returns { amount, eligible, breakdown: [..strings], bands: [...] }
export function calculateEosb(rule, input) {
  const {
    baseSalary,
    joiningDate,
    endDate = new Date(),
    terminationReason = 'Termination',
    isCitizen = false,
    currencyDecimals = 3,
  } = input;

  const round = v => {
    const f = Math.pow(10, currencyDecimals);
    return Math.round(v * f) / f;
  };

  if (!rule) return { amount: 0, eligible: false, breakdown: ['No EOSB rule configured'], bands: [] };
  if (rule.nationality_dependency === 'expat_only' && isCitizen) {
    return { amount: 0, eligible: false, breakdown: ['Not applicable to citizens (covered by social insurance pension)'], bands: [] };
  }

  let totalYears = serviceYears(joiningDate, endDate);
  const totalMonths = totalYears * 12;
  if (totalMonths < num(rule.eligibility_months, 0)) {
    return {
      amount: 0,
      eligible: false,
      breakdown: [`Service ${totalMonths.toFixed(1)} months is below the ${rule.eligibility_months}-month eligibility`],
      bands: [],
    };
  }

  // IN-style rounding: service beyond N months counts as a full year
  if (rule.round_year_after_months != null) {
    const whole = Math.floor(totalYears);
    const fracMonths = (totalYears - whole) * 12;
    totalYears = fracMonths > num(rule.round_year_after_months) ? whole + 1 : whole;
  }

  const daily = num(baseSalary) / num(rule.day_divisor, 30);
  const bands = Array.isArray(rule.tier_bands) ? rule.tier_bands : [];
  let amount = 0;
  const breakdown = [];
  const bandDetail = [];

  for (const band of bands) {
    const years = yearsWithinBand(totalYears, band);
    if (years <= 0) continue;
    const part = daily * num(band.daysPerYear) * years;
    amount += part;
    bandDetail.push({ ...band, years, amount: round(part) });
    breakdown.push(`${years.toFixed(2)} yrs × ${band.daysPerYear} days/yr = ${round(part)}`);
  }

  const factor = factorFor(rule.termination_factors, terminationReason, totalYears);
  if (factor !== 1) {
    amount *= factor;
    breakdown.push(`${terminationReason} factor × ${(factor * 100).toFixed(0)}%`);
  }

  if (rule.max_years_pay_cap != null) {
    const cap = num(baseSalary) * 12 * num(rule.max_years_pay_cap);
    if (amount > cap) {
      amount = cap;
      breakdown.push(`Capped at ${rule.max_years_pay_cap} years' pay`);
    }
  }
  if (rule.max_amount != null && amount > num(rule.max_amount)) {
    amount = num(rule.max_amount);
    breakdown.push(`Capped at statutory maximum ${rule.max_amount}`);
  }

  return { amount: round(amount), eligible: true, breakdown, bands: bandDetail };
}

// Monthly provision figure for accrual (1/12 of one year's accrual at the current band)
export function monthlyProvision(rule, input) {
  if (!rule || rule.accrual_method !== 'monthly_provision') return 0;
  const years = serviceYears(input.joiningDate, input.endDate ?? new Date());
  const bands = Array.isArray(rule.tier_bands) ? rule.tier_bands : [];
  const band = bands.find(b => {
    const from = num(b.fromYears, 0);
    const to = b.toYears == null ? Infinity : num(b.toYears);
    return years >= from && years < to;
  });
  if (!band) return 0;
  const daily = num(input.baseSalary) / num(rule.day_divisor, 30);
  return (daily * num(band.daysPerYear)) / 12;
}
