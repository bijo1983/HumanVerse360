import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function usePayrollRuns(companyId) {
  return useQuery({
    queryKey: ['payroll-runs', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_runs').select('*').eq('company_id', companyId).order('year', { ascending: false }).order('month', { ascending: false });
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
        .select('*, employees(first_name, last_name, employee_id, nationality, department_id, position_id)')
        .eq('payroll_run_id', runId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!runId,
  });
}

export function useCreatePayrollRun(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, year }) => {
      const { data: existing } = await supabase.from('payroll_runs').select('id').eq('company_id', companyId).eq('month', month).eq('year', year).maybeSingle();
      if (existing) throw new Error(`Payroll for ${month}/${year} already exists`);

      const { data: run, error: runError } = await supabase.from('payroll_runs').insert({ month, year, status: 'Draft', company_id: companyId }).select().single();
      if (runError) throw runError;

      const { data: employees } = await supabase.from('employees').select('*').eq('company_id', companyId).eq('status', 'Active');
      if (!employees?.length) return run;

      const items = employees.map(emp => {
        const gross = (emp.basic_salary || 0) + (emp.housing_allowance || 0) + (emp.transport_allowance || 0) + (emp.food_allowance || 0) + (emp.other_allowances || 0);
        const isBahraini = emp.nationality?.toLowerCase() === 'bahraini';
        const gosi_emp = isBahraini ? (emp.basic_salary || 0) * 0.07 : 0;
        const gosi_er = isBahraini ? (emp.basic_salary || 0) * 0.12 : 0;
        return {
          payroll_run_id: run.id,
          employee_id: emp.id,
          company_id: companyId,
          basic_salary: emp.basic_salary || 0,
          housing_allowance: emp.housing_allowance || 0,
          transport_allowance: emp.transport_allowance || 0,
          food_allowance: emp.food_allowance || 0,
          other_allowances: emp.other_allowances || 0,
          gross_salary: gross,
          gosi_employee: gosi_emp,
          gosi_employer: gosi_er,
          total_deductions: gosi_emp,
          net_salary: gross - gosi_emp,
          status: 'Draft',
        };
      });

      const { error: itemsError } = await supabase.from('payroll_line_items').insert(items);
      if (itemsError) throw itemsError;

      const totals = items.reduce((acc, i) => ({ gross: acc.gross + i.gross_salary, ded: acc.ded + i.total_deductions, net: acc.net + i.net_salary }), { gross: 0, ded: 0, net: 0 });
      await supabase.from('payroll_runs').update({ total_employees: employees.length, total_gross: totals.gross, total_deductions: totals.ded, total_net: totals.net }).eq('id', run.id);

      return run;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs', companyId] }),
  });
}

export function useUpdatePayrollItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, runId, ...updates }) => {
      const gross = (updates.basic_salary || 0) + (updates.housing_allowance || 0) + (updates.transport_allowance || 0) + (updates.food_allowance || 0) + (updates.other_allowances || 0) + (updates.overtime_amount || 0) + (updates.bonus || 0);
      const total_ded = (updates.gosi_employee || 0) + (updates.loan_deduction || 0) + (updates.other_deductions || 0);
      const { data, error } = await supabase.from('payroll_line_items').update({ ...updates, gross_salary: gross, total_deductions: total_ded, net_salary: gross - total_ded, updated_at: new Date().toISOString() }).eq('id', id).select().single();
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
    mutationFn: async ({ id, approvedBy }) => {
      const { error } = await supabase.from('payroll_runs').update({ status: 'Approved', approved_by: approvedBy, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      await supabase.from('payroll_line_items').update({ status: 'Approved' }).eq('payroll_run_id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-runs'] }),
  });
}

export function useSalaryComponents() {
  return useQuery({
    queryKey: ['salary-components'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_components').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}
