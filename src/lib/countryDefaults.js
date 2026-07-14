// Country configuration fallbacks used before/while the DB config loads,
// and for countries without a payroll configuration. The DB
// (countries + country_configurations) is the source of truth; these
// mirrors keep the app fully functional if the fetch fails.

export const DEFAULT_COUNTRY_CODE = 'BH';

// Minimal country list fallback for pre-auth pickers (registration).
export const FALLBACK_COUNTRY_LIST = [
  { code: 'BH', name: 'Bahrain' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'OM', name: 'Oman' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'JO', name: 'Jordan' },
  { code: 'EG', name: 'Egypt' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'OTHER', name: 'Other' },
];

// Matches the seeded Bahrain platform template — the pre-multi-country behavior.
const BH_FALLBACK = {
  countryCode: 'BH',
  countryName: 'Bahrain',
  locale: {
    currencyCode: 'BHD',
    currencySymbol: 'BD',
    currencyDecimals: 3,
    dateFormat: 'DD/MM/YYYY',
    numberLocale: 'en',
  },
  identity: {
    nationalIdLabel: 'CPR Number',
    nationalIdValidation: '^[0-9]{9}$',
    taxIdLabel: null,
  },
  calendar: {
    weekendDays: [5, 6],
    defaultWorkingDays: 26,
    dailyHours: 8,
    payrollFrequency: 'monthly',
  },
  flags: {
    incomeTax: false,
    socialInsurance: true,
    eosb: true,
    gratuity: false,
    wps: true,
  },
  raw: {},
};

// Generic defaults for countries without a payroll configuration.
const GENERIC_FALLBACK = {
  ...BH_FALLBACK,
  identity: { nationalIdLabel: 'National ID', nationalIdValidation: null, taxIdLabel: null },
  flags: { incomeTax: false, socialInsurance: false, eosb: false, gratuity: false, wps: false },
};

export function fallbackConfigFor(countryCode) {
  if (!countryCode || countryCode === 'BH') return BH_FALLBACK;
  return { ...GENERIC_FALLBACK, countryCode, countryName: countryCode };
}

// Merge a countries row + country_configurations row into the resolved
// config shape consumed by useCountryConfig()/the rest of the app.
export function buildResolvedConfig(countryRow, configRow, countryCode) {
  const fb = fallbackConfigFor(countryCode);
  if (!countryRow && !configRow) return fb;
  return {
    countryCode: countryRow?.code ?? countryCode,
    countryName: countryRow?.name ?? fb.countryName,
    locale: {
      currencyCode: countryRow?.currency_code ?? fb.locale.currencyCode,
      currencySymbol: countryRow?.currency_symbol ?? fb.locale.currencySymbol,
      currencyDecimals: countryRow?.currency_decimals ?? fb.locale.currencyDecimals,
      dateFormat: countryRow?.date_format ?? fb.locale.dateFormat,
      numberLocale: countryRow?.number_locale ?? fb.locale.numberLocale,
    },
    identity: {
      nationalIdLabel: configRow?.national_id_label ?? fb.identity.nationalIdLabel,
      nationalIdValidation: configRow?.national_id_validation ?? fb.identity.nationalIdValidation,
      taxIdLabel: configRow?.tax_id_label ?? fb.identity.taxIdLabel,
    },
    calendar: {
      weekendDays: configRow?.weekend_days ?? fb.calendar.weekendDays,
      defaultWorkingDays: Number(configRow?.default_working_days ?? fb.calendar.defaultWorkingDays),
      dailyHours: Number(configRow?.daily_hours ?? fb.calendar.dailyHours),
      payrollFrequency: configRow?.payroll_frequency ?? fb.calendar.payrollFrequency,
    },
    flags: {
      incomeTax: configRow?.income_tax_applicable ?? fb.flags.incomeTax,
      socialInsurance: configRow?.social_insurance_applicable ?? fb.flags.socialInsurance,
      eosb: configRow?.eosb_applicable ?? fb.flags.eosb,
      gratuity: configRow?.gratuity_applicable ?? fb.flags.gratuity,
      wps: configRow?.wps_applicable ?? fb.flags.wps,
    },
    raw: configRow?.config ?? {},
  };
}
