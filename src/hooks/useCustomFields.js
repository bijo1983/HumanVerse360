import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Fetch custom fields applicable to this company/country for a given module
export function useCustomFields(module, companyId, countryCode) {
  return useQuery({
    queryKey: ['custom-fields', module, companyId, countryCode],
    enabled: !!module,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('module', module)
        .eq('is_active', true)
        .order('section')
        .order('sort_order');
      if (error) throw error;

      // Client-side scope filtering:
      // Include field if:
      //   - company_id matches this company (most specific)
      //   - OR company_id is null AND (country_code matches OR country_code is null)
      return (data || []).filter(f => {
        if (f.company_id) return f.company_id === companyId;
        if (f.country_code) return f.country_code === countryCode;
        return true; // global
      });
    },
  });
}

// Fetch stored custom values for an employee
export function useEmployeeCustomValues(employeeId) {
  return useQuery({
    queryKey: ['employee-custom-values', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_custom_values')
        .select('custom_field_id, value')
        .eq('employee_id', employeeId);
      if (error) throw error;
      // Return as { [custom_field_id]: value }
      return Object.fromEntries((data || []).map(r => [r.custom_field_id, r.value]));
    },
  });
}

// Batch-fetch custom field values for many employees at once, keyed by
// field_key (not the raw custom_field_id) — used by statutory file exports
// (WPS SIF person ID, PF ECR UAN/PF number) that need a specific field
// across a whole payroll run's employees in one query.
export function useBulkFieldValuesByKey(employeeIds, fieldKeys) {
  return useQuery({
    queryKey: ['bulk-custom-values', [...(employeeIds || [])].sort(), [...(fieldKeys || [])].sort()],
    enabled: (employeeIds || []).length > 0 && (fieldKeys || []).length > 0,
    queryFn: async () => {
      const { data: fields, error: fieldsError } = await supabase
        .from('custom_fields')
        .select('id, field_key')
        .in('field_key', fieldKeys);
      if (fieldsError) throw fieldsError;
      const fieldIdToKey = Object.fromEntries((fields || []).map(f => [f.id, f.field_key]));
      const fieldIds = Object.keys(fieldIdToKey);
      if (fieldIds.length === 0) return {};

      const { data: values, error: valuesError } = await supabase
        .from('employee_custom_values')
        .select('employee_id, custom_field_id, value')
        .in('employee_id', employeeIds)
        .in('custom_field_id', fieldIds);
      if (valuesError) throw valuesError;

      const byEmployee = {};
      for (const v of values || []) {
        const key = fieldIdToKey[v.custom_field_id];
        if (!key) continue;
        byEmployee[v.employee_id] = byEmployee[v.employee_id] || {};
        byEmployee[v.employee_id][key] = v.value;
      }
      return byEmployee;
    },
  });
}

// Which sensitive custom fields have a stored (encrypted) value for this
// employee — lets the UI show a masked placeholder + Reveal button
// without ever fetching the plaintext until explicitly requested.
export function useSensitiveFieldFlags(employeeId) {
  return useQuery({
    queryKey: ['sensitive-field-flags', employeeId],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_custom_values')
        .select('custom_field_id, value_encrypted')
        .eq('employee_id', employeeId)
        .not('value_encrypted', 'is', null);
      if (error) throw error;
      return Object.fromEntries((data || []).map(r => [r.custom_field_id, true]));
    },
  });
}

// Decrypts one sensitive field's value via the permission-gated, audited
// get_employee_field_value() RPC (see migration 40) — never fetched in bulk.
export function useRevealFieldValue() {
  return useMutation({
    mutationFn: async ({ employeeId, fieldKey }) => {
      const { data, error } = await supabase.rpc('get_employee_field_value', {
        p_employee_id: employeeId,
        p_field_key: fieldKey,
      });
      if (error) throw error;
      return data;
    },
  });
}

// Save custom field values for an employee (upsert all)
export function useSaveCustomValues(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, values }) => {
      // values: { [custom_field_id]: value }
      const rows = Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([custom_field_id, value]) => ({
          company_id: companyId,
          employee_id: employeeId,
          custom_field_id,
          value: String(value),
          updated_at: new Date().toISOString(),
        }));

      if (rows.length === 0) return;

      const { error } = await supabase
        .from('employee_custom_values')
        .upsert(rows, { onConflict: 'employee_id,custom_field_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employee-custom-values', vars.employeeId] });
    },
  });
}
