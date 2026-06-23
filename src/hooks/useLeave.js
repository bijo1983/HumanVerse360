import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useLeaveTypes(companyId) {
  return useQuery({
    queryKey: ['leave-types', companyId ?? null],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Pending-only fetch: 3 separate simple queries merged in JS.
// Avoids PostgREST join resolution issues that silently return empty results.
export function usePendingLeaveRequests(companyId) {
  return useQuery({
    queryKey: ['pending-leave-requests', companyId],
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Fetch pending requests (no joins)
      const { data: requests, error: reqErr } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'Pending')
        .order('created_at', { ascending: false });
      if (reqErr) throw reqErr;
      if (!requests?.length) return [];

      // 2. Fetch related employees
      const empIds = [...new Set(requests.map(r => r.employee_id).filter(Boolean))];
      const { data: employees } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_id')
        .in('id', empIds);

      // 3. Fetch related leave types
      const ltIds = [...new Set(requests.map(r => r.leave_type_id).filter(Boolean))];
      const { data: leaveTypes } = await supabase
        .from('leave_types')
        .select('id, name, code, color, is_paid, approval_level')
        .in('id', ltIds);

      const empMap = Object.fromEntries((employees ?? []).map(e => [e.id, e]));
      const ltMap  = Object.fromEntries((leaveTypes  ?? []).map(t => [t.id, t]));

      return requests.map(r => ({
        ...r,
        employees:   empMap[r.employee_id]   ?? null,
        leave_types: ltMap[r.leave_type_id]  ?? null,
      }));
    },
    enabled: !!companyId,
  });
}

export function useLeaveRequests(filters = {}, companyId) {
  return useQuery({
    queryKey: ['leave-requests', filters, companyId],
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Fetch leave_requests without joins to avoid PostgREST join issues
      let q = supabase
        .from('leave_requests')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (filters.employee_id) q = q.eq('employee_id', filters.employee_id);
      if (filters.status)      q = q.eq('status', filters.status);
      if (filters.year)        q = q.eq('year', filters.year);

      const { data: requests, error } = await q;
      if (error) throw error;
      if (!requests?.length) return [];

      // 2. Enrich with employees and leave_types via separate queries
      const empIds = [...new Set(requests.map(r => r.employee_id).filter(Boolean))];
      const ltIds  = [...new Set(requests.map(r => r.leave_type_id).filter(Boolean))];

      const [empRes, ltRes] = await Promise.all([
        supabase.from('employees').select('id, first_name, last_name, employee_id, department_id').in('id', empIds),
        supabase.from('leave_types').select('id, name, code, color, is_paid, approval_level').in('id', ltIds),
      ]);

      const empMap = Object.fromEntries((empRes.data ?? []).map(e => [e.id, e]));
      const ltMap  = Object.fromEntries((ltRes.data  ?? []).map(t => [t.id, t]));

      return requests.map(r => ({
        ...r,
        employees:   empMap[r.employee_id]   ?? null,
        leave_types: ltMap[r.leave_type_id]  ?? null,
      }));
    },
    enabled: !!companyId,
  });
}

export function useLeaveBalances(employeeId, year, companyId) {
  return useQuery({
    queryKey: ['leave-balances', employeeId, year, companyId],
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!companyId) return [];

      // 1. Fetch balances without join
      let q = supabase.from('leave_balances').select('*').eq('company_id', companyId);
      if (employeeId) q = q.eq('employee_id', employeeId);
      if (year)       q = q.eq('year', year);
      const { data: balances, error } = await q;
      if (error) throw error;
      if (!balances?.length) return [];

      // 2. Enrich with leave_types separately
      const ltIds = [...new Set(balances.map(b => b.leave_type_id).filter(Boolean))];
      const { data: types } = await supabase
        .from('leave_types')
        .select('id, name, code, color, days_per_year')
        .in('id', ltIds);
      const ltMap = Object.fromEntries((types ?? []).map(t => [t.id, t]));

      return balances.map(b => ({ ...b, leave_types: ltMap[b.leave_type_id] ?? null }));
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
      qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
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
      qc.invalidateQueries({ queryKey: ['pending-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
    },
  });
}

// Returns { [employee_id]: leave_days_in_month } for all Approved leaves
// overlapping the given payroll month. is_paid leaves keep days_worked intact;
// unpaid leaves reduce it — exposed as { days, unpaidDays } per employee.
export function useApprovedLeaveForMonth(companyId, month, year) {
  return useQuery({
    queryKey: ['approved-leave-month', companyId, month, year],
    queryFn: async () => {
      if (!companyId || !month || !year) return {};

      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

      // Fetch all approved leaves that overlap this month
      const { data: requests, error } = await supabase
        .from('leave_requests')
        .select('employee_id, days_requested, start_date, end_date, leave_type_id')
        .eq('company_id', companyId)
        .eq('status', 'Approved')
        .lte('start_date', lastDay)
        .gte('end_date', firstDay);
      if (error) throw error;
      if (!requests?.length) return {};

      // Fetch is_paid for each leave type
      const ltIds = [...new Set(requests.map(r => r.leave_type_id).filter(Boolean))];
      const { data: types } = await supabase
        .from('leave_types')
        .select('id, is_paid')
        .in('id', ltIds);
      const ltMap = Object.fromEntries((types || []).map(t => [t.id, t]));

      const firstDate = new Date(firstDay + 'T00:00:00');
      const lastDate  = new Date(lastDay  + 'T00:00:00');

      const map = {};
      for (const req of requests) {
        const isPaid = ltMap[req.leave_type_id]?.is_paid ?? true;
        const totalDays = Number(req.days_requested) || 0;

        // Prorate if the leave spans across a month boundary
        let daysThisMonth = totalDays;
        const leaveStart = new Date(req.start_date + 'T00:00:00');
        const leaveEnd   = new Date(req.end_date   + 'T00:00:00');
        if (leaveStart < firstDate || leaveEnd > lastDate) {
          const totalCal   = Math.round((leaveEnd - leaveStart) / 86400000) + 1;
          const overlapStart = leaveStart < firstDate ? firstDate : leaveStart;
          const overlapEnd   = leaveEnd   > lastDate  ? lastDate  : leaveEnd;
          const overlapCal = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
          daysThisMonth = Math.round((totalDays * overlapCal) / totalCal);
        }
        if (!daysThisMonth) continue;

        if (!map[req.employee_id]) map[req.employee_id] = { days: 0, unpaidDays: 0 };
        map[req.employee_id].days += daysThisMonth;
        if (!isPaid) map[req.employee_id].unpaidDays += daysThisMonth;
      }
      return map;
    },
    enabled: !!companyId && !!month && !!year,
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
