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
