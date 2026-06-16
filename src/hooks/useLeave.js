import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useLeaveTypes(companyId) {
  return useQuery({
    queryKey: ['leave-types', companyId ?? null],
    queryFn: async () => {
      // Returns global rows (company_id IS NULL) plus company-specific rows
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useLeaveRequests(filters = {}, companyId) {
  return useQuery({
    queryKey: ['leave-requests', filters, companyId],
    refetchOnMount: 'always',
    queryFn: async () => {
      let q = supabase.from('leave_requests').select(`
        *, employees(first_name, last_name, employee_id, department_id),
        leave_types(name, code, color, is_paid, approval_level)
      `).eq('company_id', companyId).order('created_at', { ascending: false });
      if (filters.employee_id) q = q.eq('employee_id', filters.employee_id);
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.year) q = q.eq('year', filters.year);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useLeaveBalances(employeeId, year, companyId) {
  return useQuery({
    queryKey: ['leave-balances', employeeId, year, companyId],
    queryFn: async () => {
      let q = supabase.from('leave_balances').select(`
        *, leave_types(name, code, color, days_per_year)
      `).eq('company_id', companyId);
      if (employeeId) q = q.eq('employee_id', employeeId);
      if (year) q = q.eq('year', year);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useCreateLeaveRequest(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request) => {
      const { data, error } = await supabase.from('leave_requests').insert({ ...request, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useUpdateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase.from('leave_requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

export function useInitLeaveBalances(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, year }) => {
      const { data: types } = await supabase.from('leave_types').select('*').eq('is_active', true);
      const balances = (types ?? []).map(t => ({
        employee_id: employeeId,
        leave_type_id: t.id,
        year,
        entitled_days: t.days_per_year,
        used_days: 0,
        pending_days: 0,
        carried_forward: 0,
        company_id: companyId,
      }));
      const { error } = await supabase.from('leave_balances').upsert(balances, { onConflict: 'employee_id,leave_type_id,year' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-balances'] }),
  });
}
