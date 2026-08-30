import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { resolveTaxYear } from '../lib/taxYear';

// Posts a batch of YTD deltas via the increment_ytd_balance RPC. Shared by
// useCreatePayrollRunWithItems (run created already-approved) and
// useApprovePayrollRun (draft promoted to approved) so a run's amounts are
// rolled into next period's cumulative totals exactly once.
async function postYtdUpdates(companyId, ytdUpdates = []) {
  for (const u of ytdUpdates) {
    for (const [componentCode, delta] of Object.entries(u.deltas || {})) {
      if (!delta) continue;
      const { error } = await supabase.rpc('increment_ytd_balance', {
        p_company_id: companyId,
        p_employee_id: u.employeeId,
        p_country_code: u.countryCode,
        p_tax_year: u.taxYear,
        p_component_code: componentCode,
        p_delta: delta,
        p_period_end: u.periodEnd,
      });
      if (error) throw error;
    }
  }
}

const DEFAULT_SETTINGS = {
  bahraini_employee_gosi_pct: 8,
  bahraini_employer_gosi_pct: 13,
  expat_employee_gosi_pct: 1,
  expat_employer_gosi_pct: 3,
  working_days_per_month: 26,
  ot_rate_normal: 1.25,
  ot_rate_holiday: 1.50,
};

export function usePayrollSettings(companyId) {
  return useQuery({
    queryKey: ['payroll-settings', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('payroll_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      return data || { ...DEFAULT_SETTINGS };
    },
    enabled: !!companyId,
  });
}

export function useUpsertPayrollSettings(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('payroll_settings').upsert(
        { ...data, company_id: companyId, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-settings', companyId] }),
  });
}

export function usePayrollRuns(companyId) {
  return useQuery({
    queryKey: ['payroll-runs', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function usePayrollLineItems(runId) {
  return useQuery({
    queryKey: ['payroll-items', runId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_line_items')
        .select('*, employees(first_name, last_name, employee_id, nationality, department_id, position_id, cpr_number, bank_account, iban)')
        .eq('payroll_run_id', runId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!runId,
  });
}

// Creates a payroll run from pre-computed grid rows
export function useCreatePayrollRunWithItems(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, year, items, saveAsDraft = true, ytdUpdates = [] }) => {
      const { data: existing } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('company_id', companyId)
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();
      if (existing) throw new Error(`Payroll for ${month}/${year} already exists.`);

      const status = saveAsDraft ? 'Draft' : 'Approved';
      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .insert({ month, year, status, company_id: companyId })
        .select()
        .single();
      if (runError) throw runError;

      const lineItems = items.map(row => ({
        payroll_run_id: run.id,
        company_id: companyId,
        employee_id: row.employee_id,
        basic_salary: row.basic_salary || 0,
        housing_allowance: row.housing_allowance || 0,
        transport_allowance: row.transport_allowance || 0,
        food_allowance: row.food_allowance || 0,
        other_allowances: row.other_allowances || 0,
        overtime_hours: row.overtime_hours || 0,
        overtime_amount: row.overtime_amount || 0,
        bonus: row.bonus || 0,
        gross_salary: row.gross_salary || 0,
        gosi_employee: row.gosi_employee || 0,
        gosi_employer: row.gosi_employer || 0,
        loan_deduction: row.loan_deduction || 0,
        other_deductions: row.other_deductions || 0,
        total_deductions: row.total_deductions || 0,
        net_salary: row.net_salary || 0,
        working_days: row.days_worked || 0,
        absent_days: row.absent_days || 0,
        leave_days: row.leave_days || 0,
        status,
      }));

      if (lineItems.length) {
        const { error: itemsError } = await supabase.from('payroll_line_items').insert(lineItems);
        if (itemsError) throw itemsError;
      }

      const totals = lineItems.reduce(
        (acc, i) => ({ gross: acc.gross + i.gross_salary, ded: acc.ded + i.total_deductions, net: acc.net + i.net_salary }),
        { gross: 0, ded: 0, net: 0 }
      );
      await supabase.from('payroll_runs').update({
        total_employees: lineItems.length,
        total_gross: totals.gross,
        total_deductions: totals.ded,
        total_net: totals.net,
      }).eq('id', run.id);

      // Only post YTD balances when the run is created already-approved —
      // a draft can still be edited, and re-editing must not double-count.
      if (!saveAsDraft) await postYtdUpdates(companyId, ytdUpdates);

      return run;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs', companyId] });
      qc.invalidateQueries({ queryKey: ['ytd-balances'] });
    },
  });
}

// Bulk-updates all line items in a draft run then recalculates run totals
export function useSaveDraftItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, companyId, items }) => {
      await Promise.all(items.map(row =>
        supabase.from('payroll_line_items').update({
          basic_salary: row.basic_salary || 0,
          housing_allowance: row.housing_allowance || 0,
          transport_allowance: row.transport_allowance || 0,
          food_allowance: row.food_allowance || 0,
          other_allowances: row.other_allowances || 0,
          overtime_hours: row.overtime_hours || 0,
          overtime_amount: row.overtime_amount || 0,
          bonus: row.bonus || 0,
          gross_salary: row.gross_salary || 0,
          gosi_employee: row.gosi_employee || 0,
          gosi_employer: row.gosi_employer || 0,
          loan_deduction: row.loan_deduction || 0,
          other_deductions: row.other_deductions || 0,
          total_deductions: row.total_deductions || 0,
          net_salary: row.net_salary || 0,
          working_days: row.days_worked || 0,
          absent_days: row.absent_days || 0,
          leave_days: row.leave_days || 0,
          updated_at: new Date().toISOString(),
        }).eq('id', row.id)
      ));

      const totals = items.reduce(
        (acc, i) => ({ gross: acc.gross + (i.gross_salary || 0), ded: acc.ded + (i.total_deductions || 0), net: acc.net + (i.net_salary || 0) }),
        { gross: 0, ded: 0, net: 0 }
      );
      await supabase.from('payroll_runs').update({
        total_gross: totals.gross,
        total_deductions: totals.ded,
        total_net: totals.net,
        updated_at: new Date().toISOString(),
      }).eq('id', runId);
    },
    onSuccess: (_, { runId }) => {
      qc.invalidateQueries({ queryKey: ['payroll-items', runId] });
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
  });
}

export function useUpdatePayrollItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, runId, ...updates }) => {
      const gross = (updates.basic_salary || 0) + (updates.housing_allowance || 0) + (updates.transport_allowance || 0) + (updates.food_allowance || 0) + (updates.other_allowances || 0) + (updates.overtime_amount || 0) + (updates.bonus || 0);
      const total_ded = (updates.gosi_employee || 0) + (updates.loan_deduction || 0) + (updates.other_deductions || 0);
      const { data, error } = await supabase
        .from('payroll_line_items')
        .update({ ...updates, gross_salary: gross, total_deductions: total_ded, net_salary: gross - total_ded, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-items', vars.runId] });
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    },
  });
}

export function useApprovePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    // ytdUpdates (optional): [{ employeeId, countryCode, taxYear, periodEnd,
    //   deltas: { GROSS: 3000, PAYE: 390.5, SS_WAGES: 3000, TDS: ... } }]
    // Rolls this period's amounts into next period's cumulative YTD balance —
    // only done on approval (a draft can be re-edited without double counting).
    mutationFn: async ({ id, approvedBy, companyId, ytdUpdates = [] }) => {
      const { error } = await supabase.from('payroll_runs').update({
        status: 'Approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      await supabase.from('payroll_line_items').update({ status: 'Approved' }).eq('payroll_run_id', id);

      await postYtdUpdates(companyId, ytdUpdates);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      qc.invalidateQueries({ queryKey: ['ytd-balances'] });
    },
  });
}

// Cumulative YTD balances for every employee in a company for a tax year,
// keyed by employee then component code — e.g. balances[empId].GROSS.
// Used to feed the "before this period" totals into the statutory engine
// (GB cumulative PAYE, US SS wage-base capping, India TDS true-up).
export function useYtdBalances(companyId, taxYear) {
  return useQuery({
    queryKey: ['ytd-balances', companyId, taxYear],
    enabled: !!companyId && !!taxYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_ytd_balances')
        .select('employee_id, component_code, cumulative_amount')
        .eq('company_id', companyId)
        .eq('tax_year', taxYear);
      if (error) throw error;
      const byEmployee = {};
      for (const row of data || []) {
        byEmployee[row.employee_id] = byEmployee[row.employee_id] || {};
        byEmployee[row.employee_id][row.component_code] = Number(row.cumulative_amount) || 0;
      }
      return byEmployee;
    },
  });
}

// Fetches active LEAVE_PAY and NET_SALARY formulas from calculation_settings.
// Returns { LEAVE_PAY: "formula_string", NET_SALARY: "formula_string" } or empty object.
export function usePayrollFormulas() {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['payroll-calc-formulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calculation_settings')
        .select('code, formula')
        .eq('is_active', true)
        .in('category', ['Leave', 'Payroll']);
      if (error) throw error;
      return Object.fromEntries((data || []).map(f => [f.code, f.formula]));
    },
  });
}

export function useDeletePayrollRun(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runId) => {
      const { error: itemsError } = await supabase.from('payroll_line_items').delete().eq('payroll_run_id', runId);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from('payroll_runs').delete().eq('id', runId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs', companyId] }),
  });
}

// Effective statutory rate rules for a country (consumed by src/lib/statutory.js)
export function useStatutoryRules(countryCode) {
  return useQuery({
    queryKey: ['statutory-rules', countryCode],
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('country_statutory_rules')
        .select('*')
        .eq('country_code', countryCode)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`);
      if (error) throw error;
      return data || [];
    },
  });
}

// Active tax rules (+slabs) for a country
export function useCountryTaxRules(countryCode) {
  return useQuery({
    queryKey: ['tax-rules', countryCode],
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('tax_rules')
        .select('*, tax_slabs(*)')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`);
      if (error) throw error;
      return data || [];
    },
  });
}

// Ready-to-use statutory context for the current company's country,
// consumed by the payroll grid / computeStatutory(). Pass the payroll
// period's end date to also resolve the tax year and pull each
// employee's YTD balances (needed for GB cumulative PAYE, US FICA wage
// base capping, and India TDS true-up) — omit it for a country/date-
// agnostic context (e.g. simple monthly-average approximations still apply).
export function useStatutoryContext(periodEndDate) {
  const { company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  const { data: ruleRows = [] } = useStatutoryRules(countryCode);
  const { data: taxRules = [] } = useCountryTaxRules(countryCode);

  const taxYearInfo = periodEndDate ? resolveTaxYear(countryCode, periodEndDate) : null;
  const { data: ytdBalances = {} } = useYtdBalances(company?.id, taxYearInfo?.label);

  return {
    countryCode,
    ruleRows,
    taxRules,
    ytdBalances,
    taxYear: taxYearInfo?.label,
    monthsElapsed: taxYearInfo?.monthsElapsed,
    monthsRemaining: taxYearInfo?.monthsRemaining,
  };
}

// Active EOSB/gratuity rule for a country (company override > platform template)
export function useEosbRule(countryCode) {
  return useQuery({
    queryKey: ['eosb-rule', countryCode],
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('eosb_rules')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`);
      if (error) throw error;
      const rows = data || [];
      return rows.find(r => r.company_id) ?? rows.find(r => !r.company_id) ?? null;
    },
  });
}

// Payslip layout template for a country (company override > platform template)
export function usePayslipTemplate(countryCode) {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['payslip-template', countryCode, company?.id],
    enabled: !!countryCode,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payslip_templates')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true);
      if (error) throw error;
      const rows = data || [];
      return rows.find(r => r.company_id === company?.id) ?? rows.find(r => !r.company_id) ?? null;
    },
  });
}

// Country-scoped payroll components (company override wins over platform template by code)
export function usePayrollComponents(countryCode, companyId) {
  return useQuery({
    queryKey: ['payroll-components', countryCode, companyId],
    enabled: !!countryCode,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('payroll_components')
        .select('*')
        .or(`country_code.eq.${countryCode},country_code.is.null`)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('calculation_order');
      if (error) throw error;
      const rows = data || [];
      const merged = new Map();
      for (const r of rows.filter(r => !r.company_id)) merged.set(r.component_code, r);
      for (const r of rows.filter(r => r.company_id === companyId)) merged.set(r.component_code, r);
      return [...merged.values()]
        .filter(r => r.is_active)
        .sort((a, b) => a.calculation_order - b.calculation_order);
    },
  });
}

// Create/update a company-level component override (or custom component)
export function useSaveCompanyComponent(companyId, countryCode) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isTemplateOverride, ...fields }) => {
      if (id && !isTemplateOverride) {
        const { error } = await supabase.from('payroll_components').update(fields).eq('id', id).eq('company_id', companyId);
        if (error) throw error;
      } else {
        // Overriding a platform template creates a company row with the same code
        const { error } = await supabase.from('payroll_components').insert({
          ...fields,
          company_id: companyId,
          country_code: countryCode,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-components'] }),
  });
}

// Payroll structures + per-employee component assignments
export function usePayrollStructures(companyId) {
  return useQuery({
    queryKey: ['payroll-structures', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_structures')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEmployeeAssignments(employeeId) {
  return useQuery({
    queryKey: ['employee-assignments', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('employee_payroll_assignments')
        .select('*, payroll_components(component_code, component_name, component_type, calculation_type)')
        .eq('employee_id', employeeId)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSalaryComponents(companyId) {
  return useQuery({
    queryKey: ['salary-components', companyId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Company-level settings for one statutory module (e.g. WPS employer ID +
// bank agent code, or a PF establishment code) — stored as JSON on
// company_statutory_modules.settings (Phase 5 migration 36). Used by the
// statutory file generators (WPS SIF, PF ECR) for employer-identifying
// fields that don't belong on the employee record.
export function useModuleSettings(companyId, countryCode, moduleCode) {
  return useQuery({
    queryKey: ['module-settings', companyId, countryCode, moduleCode],
    enabled: !!companyId && !!countryCode && !!moduleCode,
    queryFn: async () => {
      const { data: mod, error: modError } = await supabase
        .from('statutory_modules')
        .select('id')
        .eq('country_code', countryCode)
        .eq('module_code', moduleCode)
        .maybeSingle();
      if (modError) throw modError;
      if (!mod) return {};
      const { data, error } = await supabase
        .from('company_statutory_modules')
        .select('settings')
        .eq('company_id', companyId)
        .eq('module_id', mod.id)
        .maybeSingle();
      if (error) throw error;
      return data?.settings || {};
    },
  });
}

export function useSaveModuleSettings(companyId, countryCode, moduleCode) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings) => {
      const { data: mod, error: modError } = await supabase
        .from('statutory_modules')
        .select('id')
        .eq('country_code', countryCode)
        .eq('module_code', moduleCode)
        .maybeSingle();
      if (modError) throw modError;
      if (!mod) throw new Error(`Statutory module ${moduleCode} is not defined for ${countryCode}`);
      // Preserve is_enabled if a row already exists — saving settings shouldn't
      // silently re-enable a module a company explicitly turned off.
      const { data: existing } = await supabase
        .from('company_statutory_modules')
        .select('is_enabled')
        .eq('company_id', companyId)
        .eq('module_id', mod.id)
        .maybeSingle();
      const { error } = await supabase.from('company_statutory_modules').upsert(
        { company_id: companyId, module_id: mod.id, is_enabled: existing?.is_enabled ?? true, settings },
        { onConflict: 'company_id,module_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['module-settings', companyId, countryCode, moduleCode] }),
  });
}
