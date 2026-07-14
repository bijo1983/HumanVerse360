# 02 — Engine Designs

Covers: country configuration model, dynamic employee master, country field mappings,
payroll component mappings, formula engine v2, payroll pipeline, tax engine,
EOSB/gratuity engine, leave/attendance/overtime, statutory modules, payslip & reports.

---

## 1. Country Configuration Model

A country is fully described by one importable JSON bundle (see `country-templates/`),
persisted across the normalized tables in `01-data-model.sql` and cached per company:

```
CountryConfiguration
├── identity          national_id_label, national_id_validation, tax_id_label
├── locale            currency_code, currency_decimals, date_format, number_locale
├── calendar          weekend_days, default_working_days, daily_hours, payroll_frequency
├── flags             income_tax, social_insurance, eosb, gratuity, wps applicable
├── employeeFields[]  → country_field_definitions
├── addressFormat     → country_address_formats
├── documents[]       → country_document_requirements
├── payrollComponents[] → payroll_components
├── statutoryModules[]  → statutory_modules (+ country_statutory_rules rates)
├── taxRules[]        → tax_rules + tax_slabs
├── eosbRules[]       → eosb_rules
├── leavePolicies[]   → leave_policy_templates
├── overtimeRules[]   → overtime_rules
├── holidays[]        → holiday_calendars
├── payslipTemplate   → payslip_templates
└── reportMappings[]  → report_field_mappings
```

### Resolution service (single entry point for all modules)

```ts
// packages/config-engine/resolveConfig.ts
export async function resolveConfig(ctx: {
  tenantId: string; companyId: string; effectiveDate: string;
}): Promise<ResolvedCountryConfig> {
  const company = await getCompany(ctx.companyId);            // has country_code
  const cacheKey = `${ctx.companyId}:${company.country_code}:${ctx.effectiveDate}`;
  return cache.getOrLoad(cacheKey, async () => {
    const template = await loadCountryRows(company.country_code, null, ctx.effectiveDate);
    const overrides = await loadCountryRows(company.country_code, ctx.companyId, ctx.effectiveDate);
    return deepMerge(template, overrides);   // override wins per (table, natural key)
  });
}
```

Merge rule: a company row with the same natural key (e.g. `component_code`,
`field_key`, `leave_code`) **replaces** the template row; company rows with new keys
**extend** the template. Cache is invalidated by a Postgres trigger notification on
any config-table write.

---

## 2. Dynamic Employee Master

One generic renderer replaces every hardcoded field in `EmployeeForm.jsx`:

```jsx
// Fetch once per form: GET /config/field-schema?module=employees
const { data: schema } = useFieldSchema('employees');   // resolved for company country

<DynamicForm
  schema={schema}                 // sections → ordered fields
  values={employee.dynamic_fields}
  onSubmit={saveEmployeeFields}
/>
```

`DynamicForm` behavior per `country_field_definitions` row:

| Metadata | Renderer behavior |
|---|---|
| `field_type` | maps to input component (`masked` renders with reveal-on-permission) |
| `is_required` | react-hook-form `required` + server-side re-validation |
| `validation_rule.regex / min / max / checksum` | client + server validation; `checksum` keys map to validators (`aadhaar_verhoeff`, `uk_nino_format`, `us_ssn_format`, `bh_cpr_checkdigit`) |
| `dependency_condition` | `{"field":"nationality_class","operator":"eq","value":"expat"}` → show/hide reactively |
| `is_sensitive` | masked display, value round-trips via encrypted store, audit on unmask |
| `maps_to_variable` | value injected into formula context (e.g. `TAX_CODE`) |
| `is_identity_field` | rendered in the header card; used by payslips/reports as "the national ID" |

**Storage:** writes go to `employee_field_values` (encrypted when sensitive); a trigger
maintains `employees.dynamic_fields` JSONB snapshot (non-sensitive only) for cheap
reads, search, and report export.

### 2a. Country-wise employee field mapping (seed content)

All fields share the logical key `national_id` (with `is_identity_field=true`) so
payslips/reports/formulas reference one key; the *label* differs per country.

| Country | Identity & statutory fields (field_key → label) |
|---|---|
| **BH** | national_id→CPR Number (`^\d{9}$`), cpr_expiry, passport_number/expiry, visa_number/expiry, work_permit_number/expiry, gosi_number, lmra_id, nationality_class (citizen/expat) |
| **AE** | national_id→Emirates ID (`^784-?\d{4}-?\d{7}-?\d$`), eid_expiry, passport, visa/residence permit, labour_card_number, mohre_number, wps_person_id, wps_agent_id, uid_number |
| **SA** | national_id→National ID / Iqama (`^[12]\d{9}$`), iqama_expiry, passport, gosi_number, work_permit_number, qiwa_contract_id, mudad_ref, saudi_national_flag |
| **OM** | national_id→Civil ID, civil_id_expiry, passport, visa, labour_card_number, pasi_number |
| **QA** | national_id→QID (`^\d{11}$`), qid_expiry, passport, visa, work_permit_number |
| **KW** | national_id→Civil ID (`^\d{12}$`), civil_id_expiry, passport, visa, work_permit_number, pifss_number |
| **IN** | national_id→Aadhaar Number (`^\d{12}$` + Verhoeff), pan_number (`^[A-Z]{5}\d{4}[A-Z]$`), uan (`^\d{12}$`), pf_number, esi_number, pt_state (select), bank_ifsc (`^[A-Z]{4}0[A-Z0-9]{6}$`) |
| **GB** | national_id→National Insurance Number (`^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$`), tax_code (default 1257L), paye_reference, pension_scheme_number, ni_category, student_loan_plan, right_to_work_status + expiry |
| **US** | national_id→SSN (`^\d{3}-?\d{2}-?\d{4}$`, sensitive), w4_filing_status (select), w4_multiple_jobs, w4_dependents_amount, w4_extra_withholding, state_tax_state (select), i9_verified (checkbox), plan_401k_pct, medicare_additional_flag |

Common global fields (country_code NULL): names, gender, DOB, nationality, marital
status, contacts, bank details (with country-conditional IBAN vs routing/IFSC),
employment fields — these stay physical columns on `employees`; only
country-variable fields move to metadata.

### 2b. Address formats (seed for `country_address_formats.fields`)

```jsonc
// BH
[{"key":"flat","label":"Flat"},{"key":"building","label":"Building","required":true},
 {"key":"road","label":"Road"},{"key":"block","label":"Block","required":true},
 {"key":"governorate","label":"Governorate","type":"select",
  "options":["Capital","Muharraq","Northern","Southern"]}]
// AE: emirate(select), area, street, building, po_box
// SA: region, city, district, street, building_number(^\d{4}$), postal_code(^\d{5}$)
// OM/QA/KW: analogous GCC structures
// IN: address_line1, address_line2, city, district, state(select:in_states), pin_code(^\d{6}$)
// GB: address_line1(required), address_line2, town_city(required), county, post_code(UK regex)
// US: address_line1(required), address_line2, city(required), state(select:us_states), zip(^\d{5}(-\d{4})?$), county
```

---

## 3. Country-wise Payroll Component Mapping (seed content)

Component codes are stable across countries where semantics match (`BASIC`, `LOAN`,
`ADV`, `ABSENCE`), enabling cross-country reporting; statutory codes are
country-scoped. `E`=earning, `D`=deduction, `ER`=employer contribution, `P`=provision.

| Country | Earnings | Deductions | Employer / Provisions |
|---|---|---|---|
| **BH** | BASIC, HOUSING, TRANSPORT, FOOD, FIXED_ALW, OTHER_ALW, OT | GOSI_EE (statutory), LOAN, ADV, ABSENCE | GOSI_ER (ER), LMRA_FEE (ER), VISA_COST (ER), EOSB_PROV (P, expat) |
| **AE** | BASIC, HOUSING, TRANSPORT, OTHER_ALW, OT | LOAN, ADV, ABSENCE, GPSSA_EE (UAE/GCC nationals) | MED_INS (ER), VISA_COST (ER), GRATUITY_PROV (P), GPSSA_ER |
| **SA** | BASIC, HOUSING, TRANSPORT, OTHER_ALW, OT | GOSI_EE (Saudi nationals), LOAN, ABSENCE | GOSI_ER (rates differ Saudi/expat), EOSB_PROV (P) |
| **OM** | BASIC, HOUSING, TRANSPORT, OT | PASI_EE (Omani), LOAN, ABSENCE | PASI_ER, EOSB_PROV (P, expat) |
| **QA** | BASIC, HOUSING, TRANSPORT, OT | LOAN, ABSENCE, PENSION_EE (Qatari) | PENSION_ER, EOSB_PROV (P) |
| **KW** | BASIC, HOUSING, TRANSPORT, OT | PIFSS_EE (Kuwaiti), LOAN, ABSENCE | PIFSS_ER, EOSB_PROV (P) |
| **IN** | BASIC, HRA, CONVEYANCE, SPECIAL_ALW, MEDICAL_ALW, BONUS, OT | PF_EE, ESI_EE, PT, TDS, LWF_EE, LOAN, ADV | PF_ER, ESI_ER, LWF_ER, GRATUITY_PROV (P), BONUS_PROV (P) |
| **GB** | BASIC, OT, BONUS, ALLOWANCE | PAYE, NI_EE, PENSION_EE, STUDENT_LOAN | NI_ER, PENSION_ER, APPRENTICE_LEVY (ER, if payroll > threshold) |
| **US** | REGULAR, OT (FLSA), BONUS, COMMISSION, ALLOWANCE | FED_TAX, STATE_TAX, SS_EE, MEDICARE_EE, K401_EE, HEALTH_INS_EE | SS_ER, MEDICARE_ER, FUTA, SUTA, K401_MATCH (ER) |

Component flags do the statutory-base work: e.g. BH `include_in_social_base=true` on
BASIC (+ configured allowances per SIO rules); IN PF base = components flagged
`include_in_social_base` capped by rule `pf_wage_cap`; EOSB base = flags
`include_in_eosb_base`.

---

## 4. Formula Engine v2

### 4.1 Security first — replace `new Function`

Current `evaluateFormula()` (`src/lib/calculations.js:113`) compiles arbitrary JS —
a tenant admin can exfiltrate data or hang the tab. Replacement: **parse to an AST
and interpret with a whitelist** (either a vetted library such as `expr-eval`/`jexl`
with prototype access disabled, or a ~300-line in-house Pratt parser — recommended,
since we control the grammar):

Allowed grammar: numeric/string/boolean literals, identifiers (registered variables
only), `+ - * / % ( )`, comparisons, `&& || !`, ternary `? :`, and **registered
function calls only**. Forbidden by construction: property access (`.`/`[]`),
assignment, `new`, loops, lambdas, template strings. Limits: max 10k AST nodes
evaluated, 50ms per formula, numbers only as results.

```ts
// packages/formula-engine/index.ts
export function evaluate(expr: string, ctx: FormulaContext): number {
  const ast = cachedParse(expr);                  // throws FormulaSyntaxError
  return interpret(ast, ctx.variables, ctx.functions, { maxSteps: 10_000, timeoutMs: 50 });
}
```

The same package runs in the browser (simulator/preview) and in the `run-payroll`
Edge Function (authoritative), guaranteeing preview = final.

### 4.2 Variable context

Built once per employee per run by `buildContext()`:

```
Identity   COUNTRY, COMPANY, EMPLOYEE_ID, EMPLOYEE_TYPE, NATIONALITY,
           NATIONALITY_CLASS ('citizen'|'expat'), GENDER, GRADE, DESIGNATION,
           DEPARTMENT, LOCATION, STATE, CITY
Pay        BASIC, GROSS, HOUSING, TRANSPORT, ALLOWANCE, <every component_code>,
           SOCIAL_BASE, EOSB_BASE, TAXABLE_GROSS, YTD_GROSS, YTD_TAX
Time       WORKING_DAYS, PAID_DAYS, ABSENT_DAYS, OT_HOURS, DAILY_HOURS,
           CALENDAR_DAYS, PAYROLL_MONTH, PAYROLL_YEAR, TAX_YEAR, PERIOD_START, PERIOD_END
Service    JOINING_DATE, SERVICE_YEARS, SERVICE_MONTHS, SERVICE_DAYS
Employee   any field with maps_to_variable (TAX_CODE, PT_STATE, W4_FILING_STATUS, GRATUITY_DAYS…)
Rules      any country_statutory_rules rule_key requested by the formula, e.g.
           SOCIAL_SECURITY_WAGE_LIMIT, PF_WAGE_CAP, NI_PRIMARY_THRESHOLD
```

Component values resolve through a **dependency graph**: the engine parses each
formula's identifiers, topologically sorts components (falling back to
`calculation_order` for ties), and rejects cycles at save time.

### 4.3 Function library (whitelisted)

`IF, ROUND, ROUNDUP, ROUNDDOWN, MIN, MAX, ABS, SUM, AVG, FLOOR, CEIL,
DATEDIFF(d1,d2,unit), YEARFRAC(d1,d2), PRORATE(amount, paidDays, workingDays),
LOOKUP(ruleKey), SLAB(amount, slabTableKey), CONCAT, ISBLANK`

### 4.4 Statutory function registry (pluggable, data-driven)

```ts
// packages/formula-engine/statutory/registry.ts
const registry: Record<string, StatutoryFn> = {
  CALCULATE_GOSI:        gosiCalculator,       // BH + SA share algorithm, differ by rates
  CALCULATE_PASI:        pasiCalculator,       // OM
  CALCULATE_PIFSS:       pifssCalculator,      // KW
  CALCULATE_GPSSA:       gpssaCalculator,      // AE nationals
  CALCULATE_PF:          pfCalculator,         // IN
  CALCULATE_ESI:         esiCalculator,        // IN
  CALCULATE_PT:          professionalTax,      // IN (state slabs)
  CALCULATE_TDS:         tdsCalculator,        // IN (regime + slabs + cess)
  CALCULATE_PAYE:        payeCalculator,       // GB (cumulative, tax code)
  CALCULATE_NI:          niCalculator,         // GB (category letters, thresholds)
  CALCULATE_FEDERAL_TAX: usFederalTax,         // US (W-4 percentage method)
  CALCULATE_STATE_TAX:   usStateTax,           // US (per-state rule rows)
  CALCULATE_FICA:        ficaCalculator,       // US SS + Medicare (wage base, addl medicare)
  CALCULATE_GRATUITY:    gratuityCalculator,   // generic band engine (AE/QA/KW/IN…)
  CALCULATE_EOSB:        eosbCalculator,       // generic band engine (BH/SA/OM)
  CALCULATE_WPS:         wpsNetValidator,      // AE/BH SIF net checks
};
```

Every calculator is a **pure function** `(ctx, rules) => Breakdown` where `rules`
comes from `country_statutory_rules` / `tax_rules` for the pay period — **no rate
literal in code**. Example:

```ts
async function gosiCalculator(ctx: FormulaContext, rules: RuleSet): Promise<Breakdown> {
  const cls = ctx.get('NATIONALITY_CLASS');                    // 'citizen' | 'expat'
  const base = Math.min(ctx.get('SOCIAL_BASE'), rules.num('gosi_wage_ceiling', Infinity));
  const eePct = rules.num(`gosi_${cls}_employee_pct`);         // BH: citizen .08 / expat .01
  const erPct = rules.num(`gosi_${cls}_employer_pct`);         // BH: citizen .13 / expat .03
  return { employee: r(base * eePct), employer: r(base * erPct), base };
}
```

Adding a country with a familiar scheme = data only. A genuinely novel algorithm =
one new registry module + rate rows; nothing else changes.

### 4.5 Versioning

Formulas live in `formula_versions` (maker-checker, effective-dated). At run time the
engine picks the **approved version active for the pay period** and stamps
`formula_version_id` + `input_snapshot` on every `payroll_run_details` row → any
historical payslip is exactly reproducible.

---

## 5. Payroll Processing Pipeline

```ts
// supabase/functions/run-payroll/index.ts  (pseudo-code)
async function runPayroll(companyId: string, periodStart: string, periodEnd: string) {
  const company = await identifyCompany(companyId);                      // 1-2 tenant+company
  const cfg     = await resolveConfig({ companyId, effectiveDate: periodEnd }); // 3-4 country config
  const run     = await createRun(company, cfg, periodStart, periodEnd);

  for (const emp of await activeEmployees(companyId, periodEnd)) {
    const statutory  = await loadEmployeeStatutoryProfile(emp, cfg);     // 5 (tax profile, ids, class)
    const structure  = await loadAssignments(emp, periodEnd);            // 6 payroll structure
    const attendance = await loadAttendance(emp, periodStart, periodEnd,
                          cfg.calendar, cfg.holidays);                   // 7 paid/absent/OT days
    const ctx = buildContext({ emp, cfg, statutory, structure, attendance, ytd: await loadYTD(emp) });

    const ordered = topoSort(structure.components);
    for (const comp of ordered.filter(c => c.type === 'earning'))        ctx.set(comp.code, calc(comp, ctx)); // 8
    ctx.set('GROSS', sumEarnings(ctx)); deriveBases(ctx, cfg);           // SOCIAL_BASE, EOSB_BASE, TAXABLE_GROSS
    for (const comp of ordered.filter(c => c.type === 'deduction' && !c.is_statutory))
                                                                          ctx.set(comp.code, calc(comp, ctx)); // 9
    for (const comp of ordered.filter(c => c.is_statutory))               ctx.set(comp.code, calc(comp, ctx)); // 10 social insurance
    for (const comp of ordered.filter(c => c.type === 'employer_contribution' || c.type === 'provision'))
                                                                          ctx.set(comp.code, calc(comp, ctx)); // 11 employer + provisions
    if (cfg.flags.income_tax) ctx.set(taxComponents, await taxEngine.calculate(ctx, cfg)); // 12
    const net = round(ctx.get('GROSS') - totalDeductions(ctx), cfg.locale.currency_decimals); // 13

    await persistDetails(run, emp, ctx, net);   // payroll_run_details + summary, formula version ids
  }
  await finalizeRun(run);                        // 14-15: payslips (country template) + statutory outputs
}
```

`calc(comp, ctx)` dispatches on `calculation_type`: `fixed` → assignment value,
`percentage` → base × pct, `formula` → `evaluate(activeVersion.expression, ctx)`,
`statutory` → `registry[comp.statutory_function](ctx, rules)`. Every amount passes the
component's rounding rule; proration applies when `is_prorated`.

No step assumes Bahrain: working days come from `cfg.calendar` (+ company override),
currency/decimals from `cfg.locale`, statutory set from enabled modules.

---

## 6. Tax Engine

```
TaxEngine.calculate(ctx, cfg):
  rules = tax_rules WHERE country=cfg.country AND tax_year=resolveTaxYear(cfg, period)
  for each applicable rule (national → jurisdiction):
    method = slab | flat_rate | formula | external
    strategy = strategies[rule.tax_code_family]
```

Country strategies (all rate data in `tax_rules`/`tax_slabs`/`employee_tax_profiles`):

- **GCC** — no personal income tax rows seeded; engine simply finds no applicable
  rules. Social insurance is handled by statutory modules, *not* the tax engine.
- **India** — regime from `employee_tax_profiles.profile.regime` (old/new); annual
  projection: `taxable = projectAnnual(TAXABLE_GROSS) − regimeDeductions(declarations)`;
  slab tax + surcharge + 4% cess (both as `country_statutory_rules` rows); §87A rebate
  row; monthly TDS = (annual tax − TDS paid YTD) / remaining months. PT per
  `pt_state` slab rows; Form 16 data accumulates in `payroll_run_details.ytd_amount`.
- **UK** — PAYE **cumulative** method: parse `tax_code` (1257L → allowance; BR/D0/D1/K
  codes as special cases), tax due YTD on cumulative pay minus cumulative allowance
  through slab table, minus tax paid YTD. NI per period (not cumulative) using
  category letter + threshold rows (PT, UEL). Pension auto-enrolment: qualifying
  earnings band rows; student loan plan thresholds.
- **US** — Federal: W-4 percentage method tables (annualize, subtract standard
  deduction row, slab, subtract dependent credits, add extra withholding). FICA:
  SS 6.2% to `ss_wage_base_limit` (YTD-aware), Medicare 1.45% + 0.9% additional over
  threshold. State: per-state `tax_rules` rows (flat or slab); no-income-tax states
  simply have no rows. FUTA/SUTA as employer statutory components with wage-base rules.

Tax year boundaries per country (`IN` Apr–Mar, `GB` 6 Apr–5 Apr, `US` calendar) are
config: `cfg.tax.year_start`. YTD accumulators reset on tax-year rollover.

---

## 7. EOSB / Gratuity Engine

One generic band algorithm serves all countries (rules in `eosb_rules`):

```ts
function calculateEOSB(ctx, rule): Breakdown {
  if (serviceMonths(ctx) < rule.eligibility_months) return zero('below eligibility');
  const base   = resolveBase(ctx, rule);                 // basic | flagged set | formula
  const daily  = base / rule.day_divisor;                // 30 (GCC) or 26 (IN gratuity)
  let amount = 0;
  for (const band of rule.tier_bands)                    // e.g. 0-3y @15d, 3+ @30d (BH)
    amount += daily * band.daysPerYear * yearsWithin(ctx.serviceYears, band);
  amount *= factorFor(rule.termination_factors, ctx.terminationReason, ctx.serviceYears);
  if (rule.max_years_cap) amount = Math.min(amount, base * 12 * rule.max_years_cap / 12);
  if (rule.max_amount)    amount = Math.min(amount, rule.max_amount);   // IN ₹20L cap
  return { amount: round(amount, ctx.currencyDecimals), bands: [...] };
}
```

Country seeds: **BH** 15d/y first 3y + 30d/y after, resignation factors ⅓/⅔/full,
expat-focused (citizens under GOSI pension); **AE** 21d/y first 5y + 30d/y after,
cap 2 years' pay; **SA** half-month/y first 5y + full month after, resignation
factors 0/⅓/⅔/full by service; **OM/QA/KW** analogous band rows; **IN** Payment of
Gratuity Act 15/26 × years (≥5y eligibility, ₹20L cap); **GB** no gratuity — final
pay = accrued holiday pay + notice (+ statutory redundancy table as optional rule);
**US** final pay + PTO payout governed by a per-state rule row
(`pto_payout_required`) + 401k settlement info block.

Monthly provision (`accrual_method='monthly_provision'`) posts to the `*_PROV`
provision component so employer cost reports carry accrued liability.

---

## 8. Leave, Holidays, Attendance & Overtime

- **Leave**: `leave_policy_templates` seeds per country — BH annual 30 (Art. 58) +
  tiered sick 15/20/20, maternity 60, hajj; AE annual 30 + sick 15/30/45 tiers;
  IN EL/CL/SL per Shops & Establishments defaults (state-overridable), maternity 26
  weeks; GB 5.6 weeks statutory annual, SSP/SMP hooks; US PTO accrual per company
  policy (no federal statutory minimum), FMLA unpaid tracking. Encashment,
  carry-forward, expiry per template row. Existing `leave_types` migrates into
  company-scoped instances generated from templates.
- **Holidays**: `holiday_calendars` national + jurisdiction rows (IN states, US
  states, AE emirates); `is_tentative` for lunar dates. Attendance and leave-day
  counting consult the calendar + weekend config.
- **Weekends**: from `country_configurations.weekend_days`, overridable per company
  (e.g. a BH company on Sat/Sun). All day-count logic uses ISO weekday arrays — the
  hardcoded Friday assumptions in current leave logic are removed.
- **Overtime**: `overtime_rules` rows; GCC normal ×1.25 / holiday-weekend ×1.5 on
  hourly-from-monthly basis; US `US_FLSA_WEEKLY` basis `weekly_threshold=40` ×1.5
  with exempt/non-exempt flag from employee fields; IN per Factories/S&E ×2 where
  applicable. `ramadan_hours` reduces divisor hours for GCC during configured
  Ramadan window. Default formula (overridable per country/company):
  `BASIC / WORKING_DAYS / DAILY_HOURS * OT_HOURS * OT_MULTIPLIER`.
- **Attendance policies**: grace, late/early deduction ladders, absence daily-rate
  basis (calendar/working/fixed-30) — replacing the fixed `working_days=26` default.

---

## 9. Statutory & Compliance Modules

`statutory_modules` rows (per country) drive three things: (a) which employee-field
tabs appear, (b) which statutory components auto-attach to structures, (c) which
compliance outputs are offered.

| Country | Modules |
|---|---|
| BH | GOSI (SIO), LMRA, CPR identity, Visa/Work-permit tracking, WPS (SIF export) |
| AE | WPS (SIF export), MOHRE, Emirates ID, Labour Card, Visa, Medical Insurance mandate, GPSSA (nationals) |
| SA | GOSI, Qiwa, Mudad, Iqama, Work Permit, WPS via Mudad |
| OM | PASI, Labour Card, Visa |
| QA | QID, Labour approval, Work permit, WPS |
| KW | Civil ID, Work permit, PIFSS (nationals) |
| IN | PF (ECR export), ESI, Professional Tax (state), LWF, TDS (24Q/Form 16 data), Aadhaar/PAN identity |
| GB | PAYE (RTI FPS/EPS data model), NI, Pension auto-enrolment, P45/P60 data, Right-to-Work |
| US | Federal WH, State WH, SS/Medicare (941 data), FUTA (940 data), SUTA, W-4, I-9, W-2 annual data |

Each module is independently toggleable per company (`company_statutory_modules`).
Compliance **outputs** in scope: file/report generation (WPS SIF, PF ECR text file,
GOSI monthly upload sheet, RTI FPS-shaped export, 941-shaped summary). Direct
government API submission is deliberately out of scope for this phase.

---

## 10. Payslip & Report Design

**Payslip** — one renderer + `payslip_templates.layout`:
identity block lists `field_key`s (so BH shows CPR + GOSI No, IN shows PAN/UAN/PF No,
US shows SSN masked `***-**-1234`); earnings/deductions blocks list component types
with country labels + i18n; employer block optional (GCC often shows employer cost,
GB/US typically not); YTD block on for GB/US/IN; currency + decimals from config
(`formatCurrency` gets locale/decimals injected — no `'BHD'`/`en-BH` defaults);
footer shows statutory references (UK tax code & NI letter, IN regime).

**Reports** — `report_field_mappings` decouples logical field → label → source.
The Excel export in `excelUtils.js` becomes:

```js
const mapping = await getReportMapping('employee_master', companyId);
const headers = mapping.filter(m => m.is_visible).map(m => m.column_label); // 'CPR Number' | 'Emirates ID' | 'SSN'
const rows = employees.map(e => mapping.map(m => resolveSource(e, m)));     // dynamic:national_id etc., masked per format
```

Cross-country consolidated reports (a tenant with BH + AE + IN companies) use the
logical key with a generic label ("National ID") and per-row country annotation, and
report per-company currency with optional FX-converted total column (rates supplied
by tenant, clearly labeled indicative).
