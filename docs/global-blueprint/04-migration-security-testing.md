# 04 — Migration Strategy, Security & Audit, Testing Plan

## 1. Migration Strategy (Bahrain-only → Global)

Strangler pattern: each phase dual-writes old + new structures behind a feature flag,
cuts over per module, and only then deprecates legacy columns. Bahrain tenants must
see **zero behavior change** until they opt into anything new.

### Step-by-step

1. **Inventory hardcoding** (automated):
   `grep -rn "CPR\|GOSI\|BHD\|Bahrain\|en-BH\|1.25\|26" src/ supabase/` → tracked
   spreadsheet of 197 known hits across 24 files; each hit tagged
   *(a) move-to-config, (b) becomes seed data, (c) legal-text keep as is*.
2. **Seed foundation**: `countries` (9 rows), Bahrain platform template
   (`country-templates/bh.json` imported), `companies.country_code='BH'` backfilled
   from the free-text `country` column (values audit first: `SELECT DISTINCT country FROM companies`).
3. **Employee fields**:
   - Insert BH `country_field_definitions` (national_id ← CPR semantics; visa,
     work permit, GOSI number…). The existing `custom_fields` BH/AE/SA/KW seed rows
     migrate 1:1 with enriched metadata.
   - Data migration: `INSERT INTO employee_field_values SELECT ... FROM employees
     WHERE cpr_number IS NOT NULL` (field national_id), same for cpr_expiry, visa_*,
     work_permit_* into their definitions; trigger builds `dynamic_fields` snapshots.
   - Back-compat: recreate `employees_full_view` (migration 13) exposing
     `cpr_number` as `dynamic_fields->>'national_id'` so legacy reads keep working;
     mark physical columns deprecated, drop in final phase only.
4. **Payroll components**:
   - Insert BH component set; map the 5 fixed salary columns → assignments:
     `basic_salary → BASIC`, `housing_allowance → HOUSING`, etc. for every active
     employee (`employee_payroll_assignments` effective from next open period).
   - `payroll_settings` GOSI percentages → `country_statutory_rules` rows
     (`gosi_citizen_employee_pct=0.08`, `gosi_citizen_employer_pct=0.13`,
     `gosi_expat_employee_pct=0.01`, `gosi_expat_employer_pct=0.03`), OT multipliers
     → `overtime_rules`, `working_days_per_month` → config calendar.
   - `calculateGOSI*()` code paths replaced by `CALCULATE_GOSI` registry calculator;
     `calculateIndemnity()` → `BH_EOSB` rule row (15/30-day bands + resignation
     factors ⅓/⅔/1); `calculation_settings` formula rows → `formula_versions` v1
     (auto-approved with change_reason 'migration', created_by system).
5. **Historical payroll**: closed `payroll_line_items` are **not** rewritten; a
   compatibility view maps them into `payroll_run_details` shape for reports. New
   runs write the new tables only.
6. **Documents**: drop the `document_type` CHECK; insert BH
   `country_document_requirements`; map existing rows by type name.
7. **Reports/payslips**: BH `report_field_mappings` + payslip template seeded to
   render **pixel-equivalent** output to today's `SalarySlip.jsx`/Excel exports.
8. **Parity gate (go/no-go)**: recompute the last 3 closed payroll months for every
   BH tenant with the new engine in shadow mode; diff per employee per component;
   requirement: 100% exact match (BHD 3dp). Sign-off recorded, then flip
   `country_engine_enabled` per tenant.
9. **Pilot countries**: activate AE, IN, GB, US templates on internal demo tenants;
   run the §3 test vectors before marketing availability. Remaining GCC (SA/OM/QA/KW)
   validated next.
10. **Cleanup (last)**: drop deprecated employee columns, `payroll_settings` Bahrain
    columns, legacy calculation functions; CI grep-gate turned on.

### Rollback

Each phase reversible: feature flag off → legacy path (columns still dual-written).
Point of no return is only step 10; schedule it ≥ 1 full payroll cycle after cutover.

---

## 2. Security & Audit Design

### Access control

- **RBAC** (extends existing `company_users.role` + `company_user_modules`): add
  permissions `payroll.formula.author`, `payroll.formula.approve`,
  `config.country.manage`, `employee.sensitive.view`, `payroll.process`,
  `payroll.approve`. Maker ≠ checker enforced at DB trigger level for
  `formula_versions` and statutory rule changes.
- **Country-wise access**: `company_users.allowed_countries char(2)[]` — a tenant HR
  user for India entities cannot open GCC companies' data; RLS predicate extended.
- **Tenant isolation**: existing `get_current_company_id()` RLS on all new tables
  (pattern in `01-data-model.sql §13`); automated cross-tenant probe tests in CI.

### Sensitive data

- Fields flagged `is_sensitive` (SSN, Aadhaar, CPR, Emirates ID, NIN, bank account):
  - **Encryption at rest**: pgsodium (Supabase Vault) column encryption into
    `value_encrypted`; decryption only via a `SECURITY DEFINER` RPC that checks
    `employee.sensitive.view` and writes a `view_sensitive` audit row.
  - **Masking by default** everywhere: list views, payslips (`***-**-1234`),
    exports; unmask is per-request, permission-gated, audited.
  - Excluded from `dynamic_fields` snapshot, logs, and analytics events.
- **Document storage**: existing private buckets (migration 18/20d) + per-company
  path prefix RLS; signed URLs with short TTL; virus-scan hook on upload.

### Audit & change control

- `payroll_audit_logs` written by trigger on: country_configurations,
  country_field_definitions, payroll_components, formula_versions,
  country_statutory_rules, tax_rules/slabs, eosb_rules, payroll run state
  transitions, sensitive-field views. Before/after JSONB, actor, IP, reason.
- Formula lifecycle: draft → pending_approval → approved (checker) → superseded;
  payroll refuses to run if any assigned component lacks an approved version for the
  period.
- Payroll reproducibility: `payroll_run_details.input_snapshot` +
  `formula_version_id` allow byte-exact recomputation of any historical payslip.

### Privacy regimes

| Regime | Controls |
|---|---|
| **GDPR (UK/EU)** | lawful-basis register per data category; DSAR export (all employee rows + field values + documents); erasure job (anonymize after retention: payroll records kept per HMRC 3+ years, then purge); DPA with tenants; EU/UK data residency note for hosting choice |
| **India DPDP Act** | consent capture on portal, purpose limitation, Aadhaar handling per UIDAI rules (store only if necessary, always encrypted+masked; consider Aadhaar *last-4 + hash* storage) |
| **US** | SSN safeguarding (state breach laws), CCPA/CPRA rights for CA employees, I-9 retention rules (3y/1y post-termination), W-2/941 retention 4y |
| **GCC** | Bahrain PDPL / UAE PDPL / Saudi PDPL: data-transfer registers, retention per labour law (2–10y) |

Retention: per-country `data_retention` rules in the config bundle drive scheduled
anonymization jobs (pg_cron), all logged.

---

## 3. Testing Plan

### 3.1 Test pyramid

1. **Unit — formula engine**: parser (grammar accept/reject incl. injection attempts
   like `constructor`, `__proto__`, property access), evaluator determinism, limits
   (step/time), every library function, rounding per currency (BHD 3dp boundary
   cases).
2. **Unit — statutory calculators**: table-driven vectors per country (below).
3. **Integration — payroll pipeline**: fixture company per country, golden-file runs
   committed to repo; any diff fails CI.
4. **E2E (Playwright)**: employee creation per country, wizard activation, payroll
   run, payslip PDF snapshot.
5. **Security suite**: RLS cross-tenant probes, sensitive-field mask/unmask audit,
   maker-checker bypass attempts.

### 3.2 Country calculation vectors (examples of the committed golden files)

| Country | Vector | Expected |
|---|---|---|
| BH | Bahraini, BASIC 800, HOUSING 100 (social base 900 if flagged) | GOSI EE 8%, ER 13%; ceiling applied if configured |
| BH | Expat, BASIC 500, 4.5y service, resignation | EOSB: 3y×15d + 1.5y×30d at daily 500/30, ×⅔ factor |
| AE | Expat, BASIC 6000, 6y service, termination | Gratuity: 5y×21d + 1y×30d, daily 6000/30, cap 2y pay |
| AE | WPS SIF export | net totals match run; SIF field layout validates |
| SA | Saudi national BASIC 8000 | GOSI EE/ER per current rate rows; expat: employer-only rates |
| IN | BASIC 20000 | PF EE = 12% × min(20000, 15000) = 1800; ER split EPS/EPF |
| IN | Gross 20000, ESI-eligible (≤21000) | ESI EE 0.75%, ER 3.25% |
| IN | CTC 12L, new regime FY2026-27 | slab tax + 4% cess; monthly TDS = (annual − YTD)/remaining months |
| IN | 7y service, last basic 30000 | Gratuity 15/26 × 30000 × 7, under ₹20L cap |
| GB | 1257L, monthly 3000, month 3 | cumulative PAYE matches HMRC calculator; NI category A per-period |
| GB | K code, BR code, student loan plan 2 | special-case handling |
| US | Single, no W-4 extras, $5000 semi-monthly | federal percentage method table match; SS capped at YTD wage base; Medicare +0.9% over threshold |
| US | Texas employee | zero state tax rows → no STATE_TAX component |
| ALL | Weekend/holiday day counts | paid-day proration honors country weekend + holiday calendar |

### 3.3 Functional test checklist (per country × scenario matrix)

- Employee creation shows correct identity label + validation (reject bad Aadhaar
  checksum, bad NIN format, bad SSN); required fields enforced server-side.
- Address form renders country layout; invalid postcode/ZIP/PIN rejected.
- Document checklist matches requirements incl. conditional (expat-only) docs;
  expiry notifications fire at configured day marks.
- Payroll components load only for the company country; disabled modules produce no
  components.
- Formula versioning: edit → pending → payroll blocked → approve → payroll uses new
  version only for periods ≥ effective_from; historical rerun uses old version.
- Payslip shows country labels, masked IDs, correct currency decimals.
- Reports export country labels; consolidated multi-company report annotates country.
- Migration: pre/post Bahrain parity (§1 step 8) — the release gate.
- Multi-tenant: tenant A cannot read tenant B config/values (direct PostgREST calls).
- Multi-company: one tenant with BH + IN companies runs both payrolls independently,
  currencies don't mix.
- RBAC: formula author cannot approve own formula; user without
  `employee.sensitive.view` never receives plaintext SSN in any payload.
- Wizard: activate Qatar from template only → create employee → run payroll → payslip,
  with zero code deployment (the "new country" acceptance test).
