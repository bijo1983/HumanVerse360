# Sample Payroll Formulas by Country

All formulas use the Formula Engine v2 grammar (`02-engines.md §4`): whitelisted
variables + functions only, stored in `formula_versions`, effective-dated and
maker-checker approved. `LOOKUP('key')` reads the effective `country_statutory_rules`
row — **no rate literal should ever be committed for a statutory value**; the literals
below are shown for readability where they are contractual (not statutory).

Prefer `calculation_type='statutory'` + registry function for statutory components;
plain formulas are for company-specific components and quick overrides.

## Bahrain (BH)

```js
// GOSI employee share — prefer the registry (rates & ceiling from rule rows):
CALCULATE_GOSI("employee")
// Equivalent explicit formula:
IF(NATIONALITY_CLASS == "citizen",
   SOCIAL_BASE * LOOKUP("gosi_citizen_employee_pct"),
   SOCIAL_BASE * LOOKUP("gosi_expat_employee_pct"))

// Overtime (Labour Law): normal ×1.25
ROUND(BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * 1.25, 3)

// Absence deduction on calendar days
ROUND(BASIC / CALENDAR_DAYS * ABSENT_DAYS, 3)

// EOSB monthly provision (expat): 15 days/yr ≤3y, 30 days/yr after
CALCULATE_EOSB("monthly_provision")
```

## UAE (AE)

```js
// Gratuity provision (expat): 21 days/yr first 5y, 30 after — via band engine
CALCULATE_GRATUITY("monthly_provision")
// Simple explicit provision (21-day years):
IF(NATIONALITY_CLASS == "expat", BASIC / 30 * 21 / 12, 0)

// GPSSA pension (UAE nationals)
IF(NATIONALITY_CLASS == "citizen",
   MIN(SOCIAL_BASE, LOOKUP("gpssa_wage_ceiling")) * LOOKUP("gpssa_employee_pct"), 0)

// Air ticket accrual (company benefit, biennial ticket cost 2000 AED)
ROUND(2000 / 24, 2)
```

## Saudi Arabia (SA)

```js
// GOSI — Saudi nationals: pension+unemployment EE share; expats: employer-only OH
CALCULATE_GOSI("employee")
// Explicit:
IF(NATIONALITY_CLASS == "citizen",
   MIN(SOCIAL_BASE, LOOKUP("gosi_wage_ceiling")) * LOOKUP("gosi_saudi_employee_pct"), 0)

// EOSB: half month/yr first 5y, full month after; resignation factors by service
CALCULATE_EOSB("settlement")
```

## Oman (OM) / Qatar (QA) / Kuwait (KW)

```js
// OM — PASI (Omani nationals)
IF(NATIONALITY_CLASS == "citizen", SOCIAL_BASE * LOOKUP("pasi_employee_pct"), 0)

// QA — gratuity: 21 days per year (min 3 weeks/yr by law)
CALCULATE_GRATUITY("monthly_provision")

// KW — PIFSS (Kuwaiti nationals, wage ceiling applies)
IF(NATIONALITY_CLASS == "citizen",
   MIN(SOCIAL_BASE, LOOKUP("pifss_wage_ceiling")) * LOOKUP("pifss_employee_pct"), 0)
```

## India (IN)

```js
// Provident Fund employee: 12% of PF wage capped at ₹15,000
MIN(SOCIAL_BASE, LOOKUP("pf_wage_cap")) * LOOKUP("pf_employee_pct")

// ESI employee (only when gross within ceiling)
IF(GROSS <= LOOKUP("esi_wage_ceiling"), ROUND(GROSS * LOOKUP("esi_employee_pct"), 0), 0)

// Professional tax: state slab lookup
SLAB(GROSS, "pt_slabs_" + PT_STATE)

// TDS — always via engine (regime, projection, cess, rebate, YTD true-up)
CALCULATE_TDS()

// HRA as 50% of basic (metro)
ROUND(BASIC * 0.5, 2)

// Gratuity provision: 15/26 per year of service
ROUND(EOSB_BASE * 15 / 26 / 12, 2)
```

## United Kingdom (GB)

```js
// PAYE — cumulative HMRC method (tax code parsing, YTD true-up)
CALCULATE_PAYE(TAX_CODE)

// Employee NI — category letter + thresholds per period
CALCULATE_NI(NI_CATEGORY, "employee")
// Explicit shape (illustrative):
MAX(0, MIN(GROSS, LOOKUP("ni_upper_earnings_limit_monthly")) - LOOKUP("ni_primary_threshold_monthly"))
  * LOOKUP("ni_employee_main_pct")
+ MAX(0, GROSS - LOOKUP("ni_upper_earnings_limit_monthly")) * LOOKUP("ni_employee_upper_pct")

// Pension auto-enrolment on qualifying earnings band
CALCULATE_PENSION_AE("employee")

// Student loan plan 2
IF(STUDENT_LOAN_PLAN == "plan2",
   ROUND(MAX(0, GROSS - LOOKUP("plan2_threshold_annual") / 12) * LOOKUP("plan_rate_pct"), 2), 0)
```

## United States (US)

```js
// Federal withholding — W-4 percentage method
CALCULATE_FEDERAL_TAX(W4_FILING_STATUS, W4_STEP2, W4_DEPENDENTS, W4_EXTRA_WH)

// Social Security employee: 6.2% up to YTD wage base
ROUND(MIN(GROSS, MAX(0, LOOKUP("ss_wage_base_limit") - YTD_SS_WAGES)) * LOOKUP("ss_rate_pct"), 2)

// Medicare with additional 0.9% over threshold
ROUND(GROSS * LOOKUP("medicare_rate_pct")
  + MAX(0, YTD_GROSS + GROSS - LOOKUP("medicare_additional_threshold")) * LOOKUP("medicare_additional_pct"), 2)

// State tax (per-state rule rows; TX/FL → engine returns 0 as no rows exist)
CALCULATE_STATE_TAX(TAX_STATE)

// FLSA overtime: 1.5× over 40h/week (weekly buckets computed by attendance loader)
IF(FLSA_STATUS == "non_exempt", WEEKLY_OT_HOURS * HOURLY_RATE * 1.5, 0)

// 401(k) with annual limit guard
ROUND(MIN(GROSS * K401_PCT / 100, LOOKUP("k401_annual_limit") - YTD_K401), 2)
```

## Cross-country patterns

```js
// Proration used by every earning with is_prorated=true (engine applies automatically):
PRORATE(AMOUNT, PAID_DAYS, WORKING_DAYS)

// Service-based allowance (any country):
IF(SERVICE_YEARS >= 5, BASIC * 0.10, IF(SERVICE_YEARS >= 2, BASIC * 0.05, 0))

// Country guard for a shared multi-country component (rarely needed —
// prefer country-scoped components — but supported):
IF(COUNTRY == "BH", BASIC * 0.07, 0)
```
