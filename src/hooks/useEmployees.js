import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useEmployees(filters = {}, companyId) {
  return useQuery({
    queryKey: ['employees', filters, companyId],
    queryFn: async () => {
      let q = supabase.from('employees_full').select('*').eq('company_id', companyId).order('first_name');
      if (filters.status) q = q.eq('status', filters.status);
      if (filters.department_id) q = q.eq('department_id', filters.department_id);
      if (filters.search) q = q.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useEmployee(id) {
  return useQuery({
    queryKey: ['employee', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees_full')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateEmployee(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employee) => {
      // eslint-disable-next-line no-unused-vars
      const { department_name, department_code, position_title, position_grade, ...payload } = employee;
      const { data, error } = await supabase.from('employees').insert({ ...payload, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, department_name, department_code, position_title, position_grade, ...updates }) => {
      const { data, error } = await supabase.from('employees').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['employee', vars.id] });
    },
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useDepartments(companyId) {
  return useQuery({
    queryKey: ['departments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('departments').select('*').eq('company_id', companyId).eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function usePositions(departmentId, companyId) {
  return useQuery({
    queryKey: ['positions', departmentId, companyId],
    queryFn: async () => {
      let q = supabase.from('positions').select('*').eq('company_id', companyId).eq('is_active', true).order('title');
      if (departmentId) q = q.eq('department_id', departmentId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useAllPositions(companyId) {
  return useQuery({
    queryKey: ['positions-all', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('positions').select('*').eq('company_id', companyId).eq('is_active', true).order('title');
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}
