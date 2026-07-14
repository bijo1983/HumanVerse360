# HumanVerse360 — Multi-Country HRMS & Payroll Platform Blueprint

**Version:** 1.0 · **Date:** 2026-07-14 · **Status:** Design approved for implementation planning

This package converts the current Bahrain-focused HR & Payroll application into a
configuration-driven, multi-country, multi-tenant SaaS platform supporting
**Bahrain, UAE, Saudi Arabia, Oman, Qatar, Kuwait, India, UK, and USA** — and any
future country added purely through configuration data, with **zero core-code changes**.

## Document Index

| File | Contents |
|---|---|
| `README.md` (this file) | Executive summary, gap analysis, target architecture, implementation phases, risks, developer checklist |
| `01-data-model.sql` | Complete proposed database schema (Postgres/Supabase DDL) |
| `02-engines.md` | Country configuration model, dynamic employee master, payroll components, formula engine, tax engine, EOSB/gratuity engine, leave/attendance/overtime, statutory modules, payslip & report design |
| `03-api-frontend.md` | Backend API design, frontend dynamic rendering design, country setup wizard |
| `04-migration-security-testing.md` | Bahrain migration strategy, security & audit design, testing plan |
| `country-templates/*.json` | Complete sample country configurations: BH, AE, IN, GB, US |
| `formula-examples.md` | Sample payroll formulas for all nine countries |

---

## 1. Executive Summary

HumanVerse360 today is a functioning multi-tenant HRMS (React 19 + Vite frontend,
Supabase/Postgres backend with row-level security) whose HR and payroll semantics are
hardwired to Bahrain: CPR as the identity field, BHD with 3 decimals as the currency,
GOSI as the only social insurance, Bahrain Labour Law Art. 116 indemnity, and a
26-working-day / Friday-weekend calendar.

The enhancement introduces a **Country Configuration Engine** as a new first-class
layer between tenancy and every functional module. Each country becomes a versioned
bundle of data: field definitions, address formats, document requirements, payroll
components, statutory rules, tax rules and slabs, leave and holiday policies, overtime
rules, EOSB/gratuity rules, payslip templates, and report label mappings. The
application code becomes a set of **generic engines** (form renderer, formula
evaluator, payroll pipeline, tax calculator, benefits calculator, report builder) that
consume this configuration at runtime.

The flow the platform implements:

```
Country Selection → Company Setup → Employee Master → Payroll Structure
      → Formula Engine → Payroll Processing → Payslips / Reports / Compliance Outputs
```

Adding country #10 later means: insert one row into `countries`, load a configuration
template (JSON import), register statutory rate tables, and (only if the country has
a genuinely novel statutory algorithm) drop a new calculator module into the statutory
function registry — never touching the form renderer, payroll pipeline, or UI.

**Key design principles**

1. **Configuration over code** — labels, fields, validations, components, rates, slabs, rules all live in data.
2. **Metadata-driven UI** — one form renderer, one payslip renderer, one report builder; country JSON decides what they show.
3. **Pluggable statutory calculators** — a registry of pure functions (`CALCULATE_GOSI`, `CALCULATE_PAYE`, …) whose *rates and thresholds* come from versioned DB tables, never literals in code.
4. **Effective-dated everything** — components, formulas, tax slabs, statutory rates all carry `effective_from`/`effective_to`; payroll always resolves the version active for the pay period.
5. **Tenant → Company → Country resolution** — a tenant can own companies in different countries; every engine resolves configuration per company (with optional per-company overrides of the country template).
6. **Auditability & maker-checker** — every configuration and formula change is versioned, approved, and logged.

---

## 2. Current Gap Analysis (grounded in the actual codebase)

| # | Area | Current implementation | Gap |
|---|------|------------------------|-----|
| 1 | Company country | `companies.country text DEFAULT 'Bahrain'` (free text, migration `03_multi_tenancy.sql`) | No ISO code, no FK to a countries master, no currency/locale/config linkage |
| 2 | Employee identity | `employees.cpr_number`, `cpr_expiry` are physical columns (`01_core_hr_schema.sql:76-77`) | Identity fields must be metadata-driven per country (Emirates ID, Aadhaar, NIN, SSN…) |
| 3 | Employee statutory/visa fields | `visa_number/expiry/type`, `work_permit_number/expiry` physical columns | Fine for GCC but irrelevant for UK/US; must be config-controlled visibility |
| 4 | Address | Single `employees.address text` | No structured, country-specific address format (Block/Road/Flat vs ZIP/State) |
| 5 | Allowances | `basic_salary, housing_allowance, transport_allowance, food_allowance, other_allowances` physical columns | Compensation must be a set of assigned payroll components, not fixed columns |
| 6 | Payroll results | `payroll_line_items` has hardcoded `gosi_employee`, `gosi_employer`, `housing_allowance`… columns (plus a `components jsonb` escape hatch) | Line items must be fully component-based rows, not fixed columns |
| 7 | Salary components | `salary_components` exists with `Fixed/Percentage/Formula` and a `formula` column — good seed | No `country_code`, no employer-contribution/provision types, `is_gosi_applicable` is Bahrain-specific, `code` is globally UNIQUE (breaks multi-country reuse), no effective dating, no applicability filters |
| 8 | Formula engine | `evaluateFormula()` in `src/lib/calculations.js:113` uses `new Function(...)` — arbitrary JS execution | Needs sandboxing, a whitelisted function library, country variables, statutory function registry, versioning |
| 9 | Statutory logic | `calculateGOSI*`, `calculateIndemnity` (BH Art. 116), OT ×1.25/×1.5 hardcoded in `calculations.js`; GOSI % hardcoded in `payroll_settings` table (`28_payroll_settings.sql`) | Must move to country statutory rules + rate tables + pluggable calculators |
| 10 | Currency & formats | `formatCurrency(amount, currency='BHD')` with `en-BH`, `minimumFractionDigits: 3` | Currency, decimals, date/number formats must come from country config (BHD=3dp, INR/GBP/USD=2dp) |
| 11 | Documents | `employee_documents.document_type` CHECK constraint hardcodes `'CPR'` etc. | Document types must be a per-country requirements table with expiry/notification rules |
| 12 | Custom fields | `custom_fields` table **already** has `country_code`, `company_id` scoping and seeds for BH/AE/SA/KW (`09_custom_fields.sql`) — good foundation | Missing: validation regex, masking/sensitivity, dependency conditions, default values, address grouping; national ID lives *both* here and as `cpr_number` column (duplication already patched once in migration 19) |
| 13 | Leave | `leave_types` global (30 days default = BH), accrual capped at 30 days in code | No per-country templates, no holiday calendars, no state holidays, no statutory leave (SSP/SMP UK, PTO US) |
| 14 | Weekend/working days | `working_days integer DEFAULT 26` on line items; no weekend model | Country weekend config (Fri/Sat vs Sat/Sun), Ramadan hours, per-company override |
| 15 | Tax | None (Bahrain has no PIT) | Full tax engine required for IN (slabs/regimes/TDS), UK (PAYE/NI), US (federal/state/FICA) |
| 16 | EOSB | `calculateIndemnity` = Bahrain only; `indemnity_settings` table exists | Country-specific gratuity/EOSB rule engine with tier bands, termination factors, contract types |
| 17 | Payslip | `SalarySlip.jsx` renders fixed fields incl. CPR | Template-driven payslip with country labels, masking, statutory blocks |
| 18 | Reports | `excelUtils.js` exports hardcoded headers ("CPR Number" appears 18×) | Metadata-label-driven report field mappings |
| 19 | Multi-tenancy | Solid: RLS + `get_current_company_id()`, company_users, plans | Extend RLS to all new config tables; platform-level (global template) vs company-level rows |
| 20 | Audit | Basic timestamps | No config change audit, no formula versions, no maker-checker |

**What we keep:** the multi-tenant RLS architecture, React Query data layer, the
`custom_fields`/`employee_custom_values` EAV pattern (promoted to the primary
mechanism), the `salary_components` concept (extended), the JS-formula UX in
`CalculationSettings.jsx` (re-based onto a safe evaluator), and the payroll run/line
item lifecycle.

---

## 3. Proposed Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             PRESENTATION (React)                        │
│  DynamicForm renderer · AddressBlock renderer · Payslip renderer        │
│  Report builder · Formula editor + simulator · Country setup wizard     │
│          (no country literal anywhere — all labels from config)         │
└───────────────▲─────────────────────────────────────────▲───────────────┘
                │ field schemas, labels, validation        │ payroll results
┌───────────────┴─────────────────────────────────────────┴───────────────┐
│                        CONFIGURATION RESOLUTION LAYER                    │
│  resolveConfig(tenant, company, countryCode, effectiveDate)              │
│  merge order: platform country template → company overrides              │
└───────────────▲─────────────────────────────────────────▲───────────────┘
                │                                          │
┌───────────────┴──────────────┐  ┌────────────────────────┴───────────────┐
│      COUNTRY CONFIG ENGINE   │  │            PAYROLL ENGINE               │
│  countries                   │  │  Pipeline: load config → structure →    │
│  country_configurations      │  │  attendance → earnings → deductions →   │
│  field_definitions           │  │  statutory → employer → tax → net       │
│  address_formats             │  │  ┌────────────────────────────────────┐ │
│  document_requirements       │  │  │  SAFE FORMULA EVALUATOR (sandbox)  │ │
│  leave_policy_templates      │  │  │  variables + function library +    │ │
│  holiday_calendars           │  │  │  STATUTORY FUNCTION REGISTRY       │ │
│  overtime_rules              │  │  │  GOSI·WPS·PF·ESI·TDS·PAYE·NI·FICA │ │
│  gratuity/eosb_rules         │  │  └───────────▲────────────────────────┘ │
│  statutory_modules           │  │              │ rates & slabs            │
│  tax_rules / tax_slabs       │──┼──────────────┘                          │
│  payslip_templates           │  │  payroll_runs · payroll_run_details     │
│  report_field_mappings       │  │  formula_versions · audit logs          │
└──────────────────────────────┘  └─────────────────────────────────────────┘
                │                                          │
┌───────────────┴──────────────────────────────────────────┴───────────────┐
│           SUPABASE / POSTGRES — RLS tenant isolation, storage,            │
│           Edge Functions (payroll run, statutory file generation)         │
└───────────────────────────────────────────────────────────────────────────┘
```

**Runtime resolution chain** used by every module:

```
tenant → company → company.country_code → country_configurations (versioned)
       → optional company-level overrides (same tables, company_id set)
       → effective-date filter for the transaction period
```

**Where calculation runs:** move payroll computation from the browser into a
**Supabase Edge Function** (`run-payroll`). The same formula-engine package is shared
by the frontend (live preview/simulator) and the Edge Function (authoritative run),
so previews match final results. The Edge Function writes `payroll_run_details`
atomically and stamps the exact formula version IDs used (see §21 in `02-engines.md`).

---

## 4. Implementation Phases

| Phase | Duration (est.) | Scope | Exit criteria |
|---|---|---|---|
| **0 — Foundation** | 2 wks | `countries`, `country_configurations`, extend `companies` with `country_code`/`currency_code`; config resolution service; feature flag `country_engine_enabled` | Bahrain config loaded from DB; app behaves identically |
| **1 — Dynamic Employee Master** | 3 wks | Promote `custom_fields` → `field_definitions` (validation, masking, dependencies, ordering); DynamicForm renderer; address formats; migrate `cpr_number` values into field values (keep read-compat view) | Employee create/edit fully metadata-driven for BH + one pilot country (AE) |
| **2 — Documents & Compliance Master** | 1.5 wks | `country_document_requirements`, expiry/notification engine, checklist UI | Country document checklists live |
| **3 — Payroll Components & Structures** | 3 wks | `payroll_components` (country-scoped, 4 types, effective-dated), `payroll_structures`, `employee_payroll_assignments`; migrate the 5 fixed salary columns | Employees paid from component assignments, not columns |
| **4 — Formula Engine v2** | 3 wks | Sandboxed evaluator, function library, variable context builder, statutory function registry, `formula_versions` + maker-checker, simulator UI | BH GOSI & indemnity run through the new engine with identical results to legacy |
| **5 — Statutory & Tax Engines** | 4 wks | `statutory_modules`, `country_statutory_rules`, `tax_rules`, `tax_slabs`; calculators: GOSI(BH/SA), PASI(OM), WPS(AE/BH), PF/ESI/PT/TDS(IN), PAYE/NI(GB), FICA/FUTA/state(US) | Golden-file test suite green for all 9 countries |
| **6 — EOSB/Gratuity & Leave** | 2.5 wks | `gratuity_rules`/`eosb_rules` band engine; `leave_policy_templates`, `holiday_calendars`, `overtime_rules` | Country EOSB parity tests pass; leave templates seeded for 9 countries |
| **7 — Payslip, Reports, WPS/RTI outputs** | 2.5 wks | `payslip_templates` renderer, `report_field_mappings`, statutory file exports (WPS SIF, PF ECR, RTI FPS concept, GOSI upload) | Country payslips + at least one statutory export per country |
| **8 — Setup Wizard & Template Import/Export** | 2 wks | 10-step wizard, clone/import/export country config JSON | Admin can activate a new country end-to-end without engineering |
| **9 — Hardening** | 2 wks | Security (masking, encryption, audit), performance, migration dress rehearsal, i18n string extraction | Production cutover of Bahrain tenants; new-country GA |

Phases 1–3 can partially overlap with 4–5 (different engineers). Realistic total: **5–6 months** with 3–4 developers.

---

## 5. Risks & Mitigation

| # | Risk | Impact | Mitigation |
|---|------|--------|-----------|
| 1 | **Bahrain regression during migration** — existing tenants' payroll changes by a fils | Critical | Golden-file parity suite: run legacy and new engine side-by-side for 3 closed months of real (anonymized) data; require exact match before cutover; keep `employees_full_view` back-compat view |
| 2 | **Formula sandbox escape** (current `new Function` is arbitrary code execution) | Critical | Replace with AST-whitelist evaluator (see `02-engines.md §8`); no `Function`/`eval`; deny property access to prototypes; execution time/step limits; formulas only editable by approved makers with checker approval |
| 3 | **Statutory rule inaccuracy** (NI thresholds, PF caps, GOSI %, state taxes change yearly) | High | All rates in effective-dated DB tables, never code; annual "legislation pack" update process; per-country test vectors from official examples; disclaimers + configurable overrides for tenants |
| 4 | **US state tax scope explosion** (50 states + local) | High | Phase US with flat-rate/percentage state table first; design tax engine so a third-party tax API can be plugged in as a calculator implementation later |
| 5 | **EAV performance** on employee field values | Medium | JSONB materialized snapshot on `employees.dynamic_fields`; GIN index; keep hot fields (national ID) also in indexed generated column for search |
| 6 | **Config drift between company override and country template** | Medium | Template versioning + "diff vs template" screen; re-sync tool in wizard |
| 7 | **Multi-currency aggregation errors** (BHD 3dp vs USD 2dp) | Medium | Store amounts as `numeric` with per-currency scale from config; never float; rounding rule per component; totals computed in DB |
| 8 | **Tenant data isolation gaps on new tables** | Critical | Every new table carries `company_id` (or is platform-global read-only); RLS policy checklist in code review; automated RLS test per table |
| 9 | **Scope creep into full compliance filing** (e-filing to GOSI/HMRC/IRS) | Medium | Phase 7 delivers *file generation* (SIF, ECR, FPS-format concept), not direct government API submission; submission integrations are separate roadmap items |
| 10 | **Legacy screens breaking mid-migration** | Medium | Strangler pattern: feature flag per module; old columns kept and dual-written until each phase completes |

---

## 6. Final Developer Checklist

**Configuration & data**
- [ ] `countries` + `country_configurations` seeded for BH, AE, SA, OM, QA, KW, IN, GB, US (ISO-3166 alpha-2, ISO-4217 currency, decimals, date/number formats, weekend days)
- [ ] Country templates importable/exportable as JSON (`country-templates/` format)
- [ ] Company setup requires `country_code`; currency + locale auto-derived
- [ ] Per-company overrides supported on every config table (nullable `company_id`)
- [ ] All config tables effective-dated where rules change over time

**Employee master**
- [ ] Zero hardcoded field labels in JSX — grep gate in CI: `grep -rn "CPR Number" src/` must return only the BH seed data
- [ ] DynamicForm renders from `field_definitions`; required/visible/validation/dependency all honored
- [ ] Address block renders from `country_address_formats`
- [ ] National ID stored once (field values), surfaced via generated column for search; legacy `cpr_number` migrated and column deprecated
- [ ] Sensitive fields (SSN, Aadhaar, CPR, Emirates ID, NIN) masked by default, unmask permission-gated, encrypted at rest, excluded from logs

**Payroll**
- [ ] Components are country-scoped, 4 types (earning/deduction/employer_contribution/provision), effective-dated, with applicability filters
- [ ] Payroll structures assigned to employees; the 5 legacy salary columns migrated
- [ ] Formula evaluator is sandboxed (no `new Function`), whitelisted functions only, step/time limited
- [ ] Statutory function registry implemented for all 9 countries; rates loaded from DB tables only
- [ ] Every formula has an approved `formula_versions` row; payroll stamps version IDs used
- [ ] Payroll run pipeline follows the 15-step order in `02-engines.md §7`; no Bahrain defaults anywhere
- [ ] Rounding per component per country config; BHD 3dp / most others 2dp verified

**Tax / EOSB / leave**
- [ ] Tax engine resolves regime + slabs by country + tax year + effective date (IN old/new regime, UK tax codes, US filing status)
- [ ] EOSB/gratuity band engine passes country parity vectors (BH Art.116, UAE 21/30-day, KSA half/full month, IN 15/26 formula…)
- [ ] Holiday calendars per country (+ state calendars IN/US), weekend config per country with company override
- [ ] Overtime multipliers configurable; Ramadan hours flag for GCC

**Payslip & reports**
- [ ] Payslip rendered from `payslip_templates`; identity numbers masked per config; currency and labels from config
- [ ] Report builder pulls labels from `report_field_mappings` / field definitions; Excel export (`excelUtils.js`) refactored off hardcoded headers

**Security & audit**
- [ ] RLS on every new table; automated cross-tenant access test
- [ ] Config, formula, and payroll audit logs write on every mutation
- [ ] Maker-checker enforced for formula and statutory rule changes
- [ ] GDPR (UK/EU), DPDP (India), and US state privacy retention/erasure jobs configured

**Testing**
- [ ] Golden-file payroll parity for Bahrain pre/post migration
- [ ] Per-country calculation test vectors (see `04-migration-security-testing.md §3`)
- [ ] Multi-tenant isolation suite
- [ ] Wizard end-to-end test: activate a brand-new country from JSON only

---

*Continue with `01-data-model.sql` for the schema, `02-engines.md` for engine designs,
`03-api-frontend.md` for API/UI, and `04-migration-security-testing.md` for migration,
security, and testing.*
