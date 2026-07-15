// ============================================================
// Country statutory calculation engine (Phase 5)
//
// Every calculator is a pure function over (ctx, rules) where all
// rates/thresholds come from country_statutory_rules and
// tax_rules/tax_slabs — no statutory rate literals live in code.
//
// Monthly-average approximations are used for annual wage bases
// (FUTA/SUTA/SS) until YTD-aware payroll runs land; for a constant
// salary these average to the correct annual amount.
// ============================================================

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
}

// Wrap country_statutory_rules rows: resolve by key + applicability,
// preferring the row matching the employee's class over the generic row.
export function makeRuleSet(rows = []) {
  return {
    num(key, { applicableTo = null, fallback = 0 } = {}) {
      const candidates = rows.filter(r => r.rule_key === key);
      const specific = candidates.find(r => r.applicable_to === applicableTo);
      const generic = candidates.find(r => !r.applicable_to);
      const row = specific ?? generic;
      return row ? num(row.rule_value, fallback) : fallback;
    },
    get(key, { applicableTo = null } = {}) {
      const candidates = rows.filter(r => r.rule_key === key);
      return (candidates.find(r => r.applicable_to === applicableTo) ?? candidates.find(r => !r.applicable_to))?.rule_value ?? null;
    },
    has(key) {
      return rows.some(r => r.rule_key === key);
    },
  };
}

// Progressive slab tax on an annual amount. slabs: [{income_from, income_to, rate_pct}]
export function slabTax(annualIncome, slabs = []) {
  let tax = 0;
  for (const s of [...slabs].sort((a, b) => num(a.income_from) - num(b.income_from))) {
    const from = num(s.income_from);
    const to = s.income_to == null ? Infinity : num(s.income_to);
    if (annualIncome <= from) break;
    tax += (Math.min(annualIncome, to) - from) * (num(s.rate_pct) / 100);
  }
  return Math.max(0, tax);
}

// Citizen detection from the free-text nationality field (used until the
// nationality_class statutory field is populated for every employee).
const CITIZEN_NATIONALITIES = {
  BH: ['bahraini'],
  SA: ['saudi', 'saudi arabian'],
  AE: ['emirati', 'uae national'],
  OM: ['omani'],
  QA: ['qatari'],
  KW: ['kuwaiti'],
};

export function isCitizenOf(countryCode, nationality, nationalityClass) {
  if (nationalityClass) {
    return !/expat/i.test(nationalityClass) && !/gcc/i.test(nationalityClass);
  }
  const list = CITIZEN_NATIONALITIES[countryCode] || [];
  return list.includes(String(nationality || '').trim().toLowerCase());
}

// ---------- GCC social insurance (GOSI / GPSSA / PASI / GRSIA / PIFSS) ----------

const GCC_SOCIAL_MODULE = { BH: 'GOSI', SA: 'GOSI', AE: 'GPSSA', OM: 'PASI', QA: 'PENSION', KW: 'PIFSS' };

function gccSocialInsurance(ctx, rules) {
  const cls = ctx.isCitizen ? 'citizen' : 'expat';
  const ceiling = rules.num('wage_ceiling', { fallback: Infinity }) || Infinity;
  const base = Math.min(num(ctx.socialBase), ceiling);
  const ee = base * rules.num('employee_pct', { applicableTo: cls });
  const er = base * rules.num('employer_pct', { applicableTo: cls });
  return { employee: ee, employer: er };
}

// ---------- India ----------

function indiaPF(ctx, rules) {
  const base = Math.min(num(ctx.socialBase), rules.num('wage_cap', { fallback: Infinity }) || Infinity);
  return { employee: base * rules.num('employee_pct'), employer: base * rules.num('employer_pct') };
}

function indiaESI(ctx, rules) {
  const ceiling = rules.num('wage_ceiling', { fallback: 0 });
  if (!ceiling || num(ctx.gross) > ceiling) return { employee: 0, employer: 0 };
  return {
    employee: Math.ceil(num(ctx.gross) * rules.num('employee_pct')),
    employer: Math.ceil(num(ctx.gross) * rules.num('employer_pct')),
  };
}

function indiaPT(ctx, rules) {
  const state = ctx.ptState || 'Karnataka';
  const slabs = rules.get(`slabs_${state}`);
  if (!Array.isArray(slabs)) return { employee: 0, employer: 0 };
  const gross = num(ctx.gross);
  for (const s of slabs) {
    if (s.upTo == null || gross <= num(s.upTo)) return { employee: num(s.amount), employer: 0 };
  }
  return { employee: 0, employer: 0 };
}

function indiaTDS(ctx) {
  const rule = pickTaxRule(ctx.taxRules, 'IN_TDS', { regime: ctx.taxRegime || 'new' });
  if (!rule) return { employee: 0, employer: 0 };
  const extras = rule.extras || {};
  const annual = Math.max(0, num(ctx.monthlyTaxable) * 12 - num(extras.standard_deduction));
  let tax = slabTax(annual, rule.tax_slabs || []);
  if (extras.rebate_87a_limit && annual <= num(extras.rebate_87a_limit)) tax = 0;
  tax *= 1 + num(extras.cess_pct) / 100;
  return { employee: tax / 12, employer: 0 };
}

// ---------- United Kingdom ----------

function ukPAYE(ctx) {
  const rule = pickTaxRule(ctx.taxRules, 'GB_PAYE');
  if (!rule) return { employee: 0, employer: 0 };
  const extras = rule.extras || {};
  const annual = num(ctx.monthlyTaxable) * 12;
  // Personal allowance from tax code when present (e.g. 1257L → 12570), else rule default
  let allowance = num(extras.personal_allowance, 12570);
  const codeMatch = /^([1-9][0-9]{0,3})[LMNPTY]/.exec(ctx.taxCode || '');
  if (codeMatch) allowance = Number(codeMatch[1]) * 10;
  if (/^BR/i.test(ctx.taxCode || '')) allowance = 0;
  const taperFrom = num(extras.allowance_taper_from, 100000);
  if (annual > taperFrom) allowance = Math.max(0, allowance - (annual - taperFrom) / 2);
  const tax = slabTax(Math.max(0, annual - allowance), rule.tax_slabs || []);
  return { employee: tax / 12, employer: 0 };
}

function ukNI(ctx, rules) {
  const gross = num(ctx.gross);
  const pt = rules.num('primary_threshold_monthly');
  const uel = rules.num('upper_earnings_limit_monthly', { fallback: Infinity }) || Infinity;
  const st = rules.num('secondary_threshold_monthly');
  const ee =
    Math.max(0, Math.min(gross, uel) - pt) * rules.num('employee_main_pct') +
    Math.max(0, gross - uel) * rules.num('employee_upper_pct');
  const er = Math.max(0, gross - st) * rules.num('employer_pct');
  return { employee: ee, employer: er };
}

function ukPensionAE(ctx, rules) {
  const gross = num(ctx.gross);
  const lower = rules.num('qualifying_lower_annual') / 12;
  const upper = (rules.num('qualifying_upper_annual', { fallback: Infinity }) || Infinity) / 12;
  const qualifying = Math.max(0, Math.min(gross, upper) - lower);
  const eePct = ctx.pensionPct != null ? num(ctx.pensionPct) / 100 : rules.num('min_employee_pct');
  return { employee: qualifying * eePct, employer: qualifying * rules.num('min_employer_pct') };
}

function ukStudentLoan(ctx, rules) {
  const plan = String(ctx.studentLoanPlan || 'none').toLowerCase().replace(/\s+/g, '');
  if (!plan || plan === 'none') return { employee: 0, employer: 0 };
  const isPgl = plan.includes('post') || plan === 'pgl';
  const thresholdKey = isPgl ? 'pgl_threshold_annual' : `${plan}_threshold_annual`;
  const rateKey = isPgl ? 'pgl_rate_pct' : 'plan_rate_pct';
  const threshold = rules.num(thresholdKey, { fallback: Infinity }) || Infinity;
  const rate = rules.num(rateKey);
  const over = Math.max(0, num(ctx.gross) - threshold / 12);
  return { employee: Math.floor(over * rate), employer: 0 };
}

// ---------- United States ----------

function usFederalTax(ctx) {
  const regime = ctx.filingStatus === 'Married filing jointly' ? 'married_joint' : 'single';
  const rule =
    pickTaxRule(ctx.taxRules, 'US_FED', { regime }) ?? pickTaxRule(ctx.taxRules, 'US_FED', { regime: 'single' });
  if (!rule) return { employee: 0, employer: 0 };
  const extras = rule.extras || {};
  const annual = Math.max(0, num(ctx.monthlyTaxable) * 12 - num(extras.standard_deduction));
  let tax = slabTax(annual, rule.tax_slabs || []);
  tax = Math.max(0, tax - num(ctx.w4Dependents));
  return { employee: tax / 12 + num(ctx.w4ExtraWithholding), employer: 0 };
}

function usStateTax(ctx) {
  const state = ctx.taxState;
  if (!state) return { employee: 0, employer: 0 };
  const rule = pickTaxRule(ctx.taxRules, 'US_STATE', { jurisdiction: state });
  if (!rule) return { employee: 0, employer: 0 }; // no-income-tax states simply have no rows
  const extras = rule.extras || {};
  const annual = Math.max(0, num(ctx.monthlyTaxable) * 12 - num(extras.standard_deduction));
  const tax = rule.calculation_method === 'flat_rate' ? annual * num(rule.flat_rate) : slabTax(annual, rule.tax_slabs || []);
  return { employee: tax / 12, employer: 0 };
}

function usFICA(ctx, rules) {
  const gross = num(ctx.gross);
  // Monthly-average wage base handling (correct annual total for level pay)
  const ssBase = Math.min(gross, rules.num('ss_wage_base_limit', { fallback: Infinity }) / 12 || Infinity);
  const ss = ssBase * rules.num('ss_rate_pct');
  const addlThreshold = rules.num('medicare_additional_threshold', { fallback: Infinity }) || Infinity;
  const medicareEE =
    gross * rules.num('medicare_rate_pct') +
    Math.max(0, gross - addlThreshold / 12) * rules.num('medicare_additional_pct');
  const medicareER = gross * rules.num('medicare_rate_pct');
  return { employee: ss + medicareEE, employer: ss + medicareER };
}

function usFUTA(ctx, rules) {
  const base = Math.min(num(ctx.gross), rules.num('wage_base', { fallback: Infinity }) / 12 || Infinity);
  return { employee: 0, employer: base * rules.num('rate_pct') };
}

function usSUTA(ctx, rules) {
  const base = Math.min(num(ctx.gross), rules.num('default_wage_base', { fallback: Infinity }) / 12 || Infinity);
  const rate = ctx.sutaRate != null ? num(ctx.sutaRate) : rules.num('default_rate_pct');
  return { employee: 0, employer: base * rate };
}

// ---------- Rule/tax lookup helpers ----------

function pickTaxRule(taxRules = [], taxCode, { regime = null, jurisdiction = null } = {}) {
  return (
    taxRules.find(
      r =>
        r.tax_code === taxCode &&
        (regime == null || r.regime === regime) &&
        (jurisdiction == null || r.jurisdiction === jurisdiction)
    ) ?? null
  );
}

function subset(rows, moduleCode) {
  return makeRuleSet(rows.filter(r => r.module_code === moduleCode));
}

// ---------- Country dispatch ----------
// Computes all statutory amounts for one employee-month.
// ctx: { countryCode, nationality, nationalityClass, socialBase, gross,
//        monthlyTaxable, ruleRows, taxRules, ptState, taxRegime, taxCode,
//        pensionPct, studentLoanPlan, filingStatus, taxState,
//        w4Dependents, w4ExtraWithholding, sutaRate }
// Returns { employee, employer, breakdown: [{code, name, employee, employer}] }
export function computeStatutory(ctx) {
  const rows = ctx.ruleRows || [];
  const country = ctx.countryCode;
  const items = [];
  const add = (code, name, res) => {
    if (!res) return;
    const employee = Math.max(0, num(res.employee));
    const employer = Math.max(0, num(res.employer));
    if (employee || employer) items.push({ code, name, employee, employer });
  };

  const isCitizen = isCitizenOf(country, ctx.nationality, ctx.nationalityClass);
  const c = { ...ctx, isCitizen };

  if (GCC_SOCIAL_MODULE[country]) {
    const module = GCC_SOCIAL_MODULE[country];
    add(module, `${module} Social Insurance`, gccSocialInsurance(c, subset(rows, module)));
  } else if (country === 'IN') {
    add('PF', 'Provident Fund', indiaPF(c, subset(rows, 'PF')));
    add('ESI', 'ESI', indiaESI(c, subset(rows, 'ESI')));
    add('PT', 'Professional Tax', indiaPT(c, subset(rows, 'PT')));
    add('TDS', 'Income Tax (TDS)', indiaTDS(c));
  } else if (country === 'GB') {
    add('PAYE', 'PAYE Income Tax', ukPAYE(c));
    add('NI', 'National Insurance', ukNI(c, subset(rows, 'NI')));
    add('PENSION', 'Pension (Auto-Enrolment)', ukPensionAE(c, subset(rows, 'PENSION')));
    add('STUDENT_LOAN', 'Student Loan', ukStudentLoan(c, subset(rows, 'STUDENT_LOAN')));
  } else if (country === 'US') {
    add('FED_TAX', 'Federal Income Tax', usFederalTax(c));
    add('STATE_TAX', 'State Income Tax', usStateTax(c));
    add('FICA', 'Social Security & Medicare', usFICA(c, subset(rows, 'FICA')));
    add('FUTA', 'FUTA', usFUTA(c, subset(rows, 'FUTA')));
    add('SUTA', 'SUTA', usSUTA(c, subset(rows, 'SUTA')));
  }

  const round = v => Math.round(v * 1000) / 1000;
  return {
    employee: round(items.reduce((a, i) => a + i.employee, 0)),
    employer: round(items.reduce((a, i) => a + i.employer, 0)),
    breakdown: items.map(i => ({ ...i, employee: round(i.employee), employer: round(i.employer) })),
  };
}
