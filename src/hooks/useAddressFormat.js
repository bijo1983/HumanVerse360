import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Address field layout for a country (company override > platform template).
export function useAddressFormat(countryCode, companyId) {
  return useQuery({
    queryKey: ['address-format', countryCode, companyId],
    enabled: !!countryCode,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('country_address_formats')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true);
      if (error) throw error;
      const rows = data || [];
      return rows.find(r => r.company_id === companyId) ?? rows.find(r => !r.company_id) ?? null;
    },
  });
}

// Structured address stored for an employee.
export function useEmployeeAddress(employeeId, addressType = 'current') {
  return useQuery({
    queryKey: ['employee-address', employeeId, addressType],
    enabled: !!employeeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_addresses')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('address_type', addressType)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveEmployeeAddress(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, countryCode, addressData, addressType = 'current' }) => {
      const { error } = await supabase.from('employee_addresses').upsert(
        {
          company_id: companyId,
          employee_id: employeeId,
          address_type: addressType,
          country_code: countryCode,
          address_data: addressData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'employee_id,address_type' }
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['employee-address', vars.employeeId] });
    },
  });
}

// Render a one-line address from the format's display_template
// ('{{key}}' placeholders); empty segments are dropped.
export function renderAddressLine(template, data) {
  if (!template || !data) return '';
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => s && !/^(Flat|Bldg|Road|Block|Street|Way|Unit|Zone|PO Box)$/i.test(s))
    .join(', ');
}
