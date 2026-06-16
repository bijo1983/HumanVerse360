import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Education ─────────────────────────────────────────────────────────────────

export function useEmployeeEducation(employeeId, companyId) {
  return useQuery({
    queryKey: ['education', employeeId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_education')
        .select('*')
        .eq('employee_id', employeeId)
        .order('year_completed', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!companyId,
  });
}

export function useCreateEducation(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('employee_education').insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['education', v.employee_id] }),
  });
}

export function useUpdateEducation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase.from('employee_education').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['education'] }),
  });
}

export function useDeleteEducation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employee_education').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['education'] }),
  });
}

// ── Work History ──────────────────────────────────────────────────────────────

export function useEmployeeWorkHistory(employeeId, companyId) {
  return useQuery({
    queryKey: ['work-history', employeeId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_work_history')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!companyId,
  });
}

export function useCreateWorkHistory(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('employee_work_history').insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['work-history', v.employee_id] }),
  });
}

export function useUpdateWorkHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase.from('employee_work_history').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-history'] }),
  });
}

export function useDeleteWorkHistory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employee_work_history').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-history'] }),
  });
}

// ── Dependents ────────────────────────────────────────────────────────────────

export function useEmployeeDependents(employeeId, companyId) {
  return useQuery({
    queryKey: ['dependents', employeeId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_dependents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!companyId,
  });
}

export function useCreateDependent(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('employee_dependents').insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['dependents', v.employee_id] }),
  });
}

export function useUpdateDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase.from('employee_dependents').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dependents'] }),
  });
}

export function useDeleteDependent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employee_dependents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dependents'] }),
  });
}
