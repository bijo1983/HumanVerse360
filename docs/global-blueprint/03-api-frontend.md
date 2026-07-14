# 03 — Backend API & Frontend Design

## 1. Backend API Design

Implementation note: on the current Supabase stack these are a mix of PostgREST
queries (read-heavy config endpoints, already RLS-guarded), Postgres RPCs, and Edge
Functions (payroll run, formula validation, file generation). The contract below is
transport-agnostic so the same shape works if a dedicated API service is introduced
later.

**Common request context** (headers / JWT claims): `tenant_id` (implicit in auth),
`company_id`, plus explicit `country_code` and `effective_date` query params where
relevant. All config reads accept `effective_date` (default: today).

### Configuration APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/countries` | GET | Active country list (code, name, currency, decimals, flags) |
| `/countries/{code}/configuration` | GET | Resolved config bundle for company (template ⊕ overrides), `?effective_date=` |
| `/countries/{code}/field-schema?module=employees` | GET | Ordered sections+fields for DynamicForm |
| `/countries/{code}/address-format` | GET | Address field layout |
| `/countries/{code}/document-requirements` | GET | Document checklist (+ `?nationality_class=` filter) |
| `/countries/{code}/payroll-components` | GET | Components incl. type, flags, active formula version |
| `/countries/{code}/statutory-modules` | GET | Modules + enablement + current rates |
| `/countries/{code}/tax-rules?tax_year=` | GET | Rules + slabs |
| `/countries/{code}/leave-rules` | GET | Leave templates + holiday calendar `?year=&jurisdiction=` |
| `/countries/{code}/configuration/clone` | POST | Clone template → company override set, or country → new country draft |
| `/countries/{code}/configuration/export` | GET | Full JSON bundle (country-templates format) |
| `/countries/import` | POST | Import/validate a JSON bundle as draft configuration |

### Employee APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/employees/{id}/fields` | GET/PUT | Read/write dynamic field values (server re-validates against schema; sensitive fields write-only unless unmask permission) |
| `/employees/{id}/address` | GET/PUT | Address data validated against country format |
| `/employees/{id}/documents/checklist` | GET | Requirements merged with uploaded docs + expiry status |
| `/employees/{id}/tax-profile?tax_year=` | GET/PUT | Regime / W-4 / tax code / declarations |

### Payroll APIs

| Endpoint | Method | Purpose |
|---|---|---|
| `/payroll/runs` | POST | Start run `{company_id, period_start, period_end}` → Edge Function pipeline (async, status polling) |
| `/payroll/runs/{id}` | GET | Run status + summaries |
| `/payroll/runs/{id}/details?employee_id=` | GET | Component-level results + formula versions used |
| `/payroll/preview` | POST | Dry-run one employee `{employee_id, period}` → full breakdown (uses same engine, no writes) |
| `/payroll/formulas/validate` | POST | `{expression, country_code}` → parse result, variables used, sample evaluation, dependency check |
| `/payroll/formulas` | POST/PUT | Create/update draft `formula_versions` row |
| `/payroll/formulas/{id}/submit` `/approve` `/reject` | POST | Maker-checker transitions (approver ≠ maker enforced) |
| `/payroll/runs/{id}/payslips` | POST | Generate payslips from country template (PDF batch) |
| `/payroll/runs/{id}/statutory-outputs?type=wps_sif|pf_ecr|gosi_upload|rti_fps|941_summary` | POST | Country compliance file generation |

### Design rules

- Every mutating config endpoint writes a `payroll_audit_logs` row (before/after).
- Config reads are cached (ETag on configuration version); cache busts on version bump.
- Import validates: JSON schema → referential integrity (component codes in formulas
  exist) → formula parse → dry-run against a synthetic employee → report.
- All endpoints are tenant-scoped by RLS even if a client forges `company_id`.

---

## 2. Frontend Dynamic Rendering Design

### Principles

1. **No country literal in JSX.** CI grep-gate: `CPR|Emirates ID|Aadhaar|SSN` must not
   appear in `src/` outside test fixtures and seed data.
2. One `useCountryConfig()` hook (React Query, keyed by `companyId + configVersion`)
   feeds every screen; components read labels/flags from it:
   `label = config.employeeFields.national_id.label`.
3. Formatting helpers become config-injected: `formatCurrency(amount, config.locale)`,
   `formatDate(d, config.locale.date_format)` — the `'BHD'`/`en-BH`/3-decimals
   defaults in `src/lib/calculations.js` are removed.

### Core components

| Component | Replaces | Behavior |
|---|---|---|
| `<DynamicForm schema values>` | hardcoded sections of `EmployeeForm.jsx` | renders sections/fields from schema; validation, dependency show/hide, masked inputs, i18n labels |
| `<AddressBlock format value>` | single `address` textarea | country layout, per-field validation, select sources (states/emirates/governorates) |
| `<DocumentChecklist requirements>` | fixed document type list | mandatory badges, expiry chips (reuses existing status ladder), conditional by nationality class |
| `<StatutoryTabs modules>` | fixed GOSI section | one tab per enabled statutory module, fields from `module.employee_fields` |
| `<ComponentGrid components>` | fixed salary columns in payroll pages | earnings/deductions/employer/provision groups, country ordering + labels |
| `<PayslipPreview template result>` | `SalarySlip.jsx` fixed layout | renders `payslip_templates.layout`; masking applied |
| `<FormulaEditor>` + `<FormulaSimulator>` | `CalculationSettings.jsx` forms | autocomplete from variable catalog (country-aware), live parse errors, test against a real/synthetic employee, side-by-side version diff, maker-checker actions |
| `<ReportBuilder mapping>` | hardcoded `excelUtils.js` headers | column picker from `report_field_mappings`, label preview per country |

### Rendering flow

```
App start → company context → useCountryConfig(companyId)
  → schema-driven routes decide visible modules (e.g. "Tax" menu hidden for GCC,
    "Indemnity" renamed from config: BH "Indemnity" / AE "Gratuity" / GB hidden)
  → each form/list/report pulls its slice of config; suspense fallback until loaded
  → all writes send field_key/value pairs; server validates against the same schema
```

### i18n

`field_label_i18n` / `component_name_i18n` JSONB carry translations (en/ar/hi seeded);
UI language is a user preference, country decides *defaults* (AR secondary for GCC).
RTL support via existing Tailwind logical properties.

---

## 3. Country Setup Wizard

Route: `/settings/country-setup` (company admin) and `/admin/country-templates`
(platform admin authoring the templates themselves).

| Step | Screen | Actions |
|---|---|---|
| 1 | **Select country** | Pick from `countries`; shows currency, weekend, flags summary. Warns if company already active on another country |
| 2 | **Employee fields** | Template `country_field_definitions` loaded into an editable grid: toggle visibility/required, edit labels/help, add custom fields, reorder. Identity field locked (must exist) |
| 3 | **Address format** | Preview rendered address block; reorder/relabel; edit validation |
| 4 | **Documents** | Requirement list: mandatory toggles, expiry tracking + notification days, conditional rules |
| 5 | **Payroll components** | Component grid by type; enable/disable, default values, taxable/social-base/EOSB-base flags; formulas shown read-only with "edit in Formula Editor" link |
| 6 | **Statutory modules** | Enable/disable modules; module settings (WPS bank codes, PF establishment code, PAYE reference); current rate table preview with effective dates |
| 7 | **Leave & holidays** | Leave templates editable; holiday calendar for current year (import national set, add company days) |
| 8 | **Tax & EOSB** | Tax year + regimes preview (read-only rates, company can't edit statutory rates — only platform legislation packs can); EOSB rule bands preview; provision accrual on/off |
| 9 | **Review** | Full diff vs platform template; validation report (identity field present, default structure has BASIC, formulas parse, at least one payslip template) |
| 10 | **Activate** | Creates `country_configurations` company version (status active), generates company leave types, default payroll structure, payslip template; writes audit log |

Wizard output = the same JSON bundle as import/export, so "configure by wizard" and
"configure by file" are interchangeable. Re-running the wizard on an active country
enters *revision mode* (new version, effective-dated, maker-checker if statutory
objects changed).
