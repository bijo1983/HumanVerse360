import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useDocuments(filters = {}, companyId) {
  return useQuery({
    queryKey: ['documents', filters, companyId],
    queryFn: async () => {
      let q = supabase.from('employee_documents').select(`
        *, employees(first_name, last_name, employee_id, department_id)
      `).eq('company_id', companyId).order('expiry_date', { ascending: true, nullsLast: true });
      if (filters.employee_id) q = q.eq('employee_id', filters.employee_id);
      if (filters.document_type) q = q.eq('document_type', filters.document_type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useExpiringDocuments(days = 90, companyId) {
  return useQuery({
    queryKey: ['expiring-documents', days, companyId],
    queryFn: async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*, employees(first_name, last_name, employee_id, department_id)')
        .eq('company_id', companyId)
        .lte('expiry_date', futureDate.toISOString().split('T')[0])
        .order('expiry_date');
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateDocument(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (doc) => {
      const { data, error } = await supabase.from('employee_documents').insert({ ...doc, company_id: companyId }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase.from('employee_documents').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('employee_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export function useNotifications(companyId) {
  return useQuery({
    queryKey: ['notifications', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_notifications')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
    refetchInterval: 60000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('system_notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
