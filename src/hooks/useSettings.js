import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Lookups ──────────────────────────────────────────────────────────────────

export function useLookups(type, companyId) {
  return useQuery({
    queryKey: ['lookups', type, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('setting_lookups')
        .select('*')
        .eq('lookup_type', type)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!type,
  });
}

export function useCreateLookup(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('setting_lookups').insert({ ...data, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['lookups', vars.lookup_type] }),
  });
}

export function useUpdateLookup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase.from('setting_lookups').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lookups'] }),
  });
}

export function useDeleteLookup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('setting_lookups').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lookups'] }),
  });
}

// ── Employee Number Config ────────────────────────────────────────────────────

export function useEmployeeNumberConfig(companyId) {
  return useQuery({
    queryKey: ['emp-num-config', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_number_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useUpsertEmployeeNumberConfig(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const { error } = await supabase.from('employee_number_config').upsert(
        { ...data, company_id: companyId, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emp-num-config', companyId] }),
  });
}

// ── Employee number preview helper ────────────────────────────────────────────

export function generateEmployeeId(config, sequenceNumber) {
  if (!config) return `EMP${String(sequenceNumber || 1001).padStart(4, '0')}`;
  const sep = config.separator || '';
  const now = new Date();
  const parts = [config.prefix || 'EMP'];
  if (config.include_year) parts.push(now.getFullYear().toString());
  if (config.include_month) parts.push(String(now.getMonth() + 1).padStart(2, '0'));
  parts.push(String(sequenceNumber || config.starting_number || 1001).padStart(config.pad_length || 4, '0'));
  return parts.join(sep);
}
