import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  DEFAULT_COUNTRY_CODE,
  FALLBACK_COUNTRY_LIST,
  buildResolvedConfig,
  fallbackConfigFor,
} from '../lib/countryDefaults';

// Active country list (works pre-auth for the registration picker).
export function useCountries({ payrollSupportedOnly = false } = {}) {
  const query = useQuery({
    queryKey: ['countries', payrollSupportedOnly],
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      let q = supabase.from('countries').select('*').eq('is_active', true).order('sort_order');
      if (payrollSupportedOnly) q = q.eq('is_payroll_supported', true);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
  const countries =
    query.data && query.data.length > 0
      ? query.data
      : FALLBACK_COUNTRY_LIST.filter(c => !payrollSupportedOnly || c.code !== 'OTHER');
  return { ...query, countries };
}

// Resolved country configuration for the current company:
// countries row + active country_configurations row
// (company override preferred over the platform template).
// Always returns a usable config — falls back to the Bahrain-equivalent
// defaults so existing behavior is preserved while loading or on error.
export function useCountryConfig() {
  const { company } = useAuth();
  const countryCode = company?.country_code || DEFAULT_COUNTRY_CODE;
  const companyId = company?.id ?? null;

  const query = useQuery({
    queryKey: ['country-config', countryCode, companyId],
    enabled: !!company,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [countryRes, configRes] = await Promise.all([
        supabase.from('countries').select('*').eq('code', countryCode).maybeSingle(),
        supabase
          .from('country_configurations')
          .select('*')
          .eq('country_code', countryCode)
          .eq('status', 'active')
          .lte('effective_from', today)
          .or(`effective_to.is.null,effective_to.gte.${today}`)
          .order('version', { ascending: false }),
      ]);
      if (countryRes.error) throw countryRes.error;
      if (configRes.error) throw configRes.error;

      const configs = configRes.data || [];
      // Company override wins over the platform template
      const configRow =
        configs.find(c => c.company_id === companyId) ??
        configs.find(c => c.company_id === null) ??
        null;

      return buildResolvedConfig(countryRes.data, configRow, countryCode);
    },
  });

  return {
    config: query.data ?? fallbackConfigFor(countryCode),
    countryCode,
    isLoading: query.isLoading,
    isFallback: !query.data,
    error: query.error,
  };
}
