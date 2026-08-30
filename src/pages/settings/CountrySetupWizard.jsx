import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Globe2, Check, ChevronLeft, ChevronRight, Users, MapPin, FileText, Layers, Landmark, CalendarDays, Percent, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useCountries } from '../../hooks/useCountryConfig';
import { useCustomFields } from '../../hooks/useCustomFields';
import { useAddressFormat } from '../../hooks/useAddressFormat';
import { useDocumentRequirements } from '../../hooks/useDocuments';
import { usePayrollComponents, useStatutoryRules, useCountryTaxRules, useEosbRule } from '../../hooks/usePayroll';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Form';

const STEPS = [
  { key: 'country', label: 'Country', icon: Globe2 },
  { key: 'fields', label: 'Employee Fields', icon: Users },
  { key: 'address', label: 'Address Format', icon: MapPin },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'components', label: 'Payroll Components', icon: Layers },
  { key: 'statutory', label: 'Statutory Modules', icon: Landmark },
  { key: 'leave', label: 'Leave & Holidays', icon: CalendarDays },
  { key: 'tax', label: 'Tax & EOSB', icon: Percent },
  { key: 'review', label: 'Review & Activate', icon: ClipboardCheck },
];

export default function CountrySetupWizard() {
  const { company, companyId, refreshCompany } = useAuth();
  const qc = useQueryClient();
  const { countries } = useCountries({ payrollSupportedOnly: true });
  const [step, setStep] = useState(0);
  const [countryCode, setCountryCode] = useState(company?.country_code || 'BH');
  const [activating, setActivating] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const country = countries.find(c => c.code === countryCode);

  // All configuration slices for the selected country (platform templates + company overrides)
  const { data: fields = [] } = useCustomFields('employees', companyId, countryCode);
  const { data: addressFormat } = useAddressFormat(countryCode, companyId);
  const { data: documents = [] } = useDocumentRequirements(countryCode, companyId);
  const { data: components = [] } = usePayrollComponents(countryCode, companyId);
  const { data: statutoryRules = [] } = useStatutoryRules(countryCode);
  const { data: taxRules = [] } = useCountryTaxRules(countryCode);
  const { data: eosbRule } = useEosbRule(countryCode);

  const activate = async () => {
    setActivating(true);
    setError('');
    try {
      // 1. Point the company at the selected country (currency syncs via DB trigger)
      const { error: cErr } = await supabase
        .from('companies')
        .update({ country_code: countryCode, country: country?.name || countryCode, updated_at: new Date().toISOString() })
        .eq('id', companyId);
      if (cErr) throw cErr;

      // 2. Enable the country's default statutory modules for this company
      const { data: modules } = await supabase
        .from('statutory_modules')
        .select('id, is_enabled_by_default')
        .eq('country_code', countryCode);
      if (modules?.length) {
        await supabase.from('company_statutory_modules').upsert(
          modules.map(m => ({ company_id: companyId, module_id: m.id, is_enabled: m.is_enabled_by_default })),
          { onConflict: 'company_id,module_id' }
        );
      }

      // 3. Ensure a default payroll structure exists for the country
      const { data: existingStructure } = await supabase
        .from('payroll_structures')
        .select('id')
        .eq('company_id', companyId)
        .eq('country_code', countryCode)
        .limit(1);
      if (!existingStructure?.length) {
        await supabase.from('payroll_structures').insert({
          company_id: companyId,
          country_code: countryCode,
          name: `${country?.name || countryCode} Default Structure`,
          description: 'Created by country setup wizard',
          is_default: true,
        });
      }

      // 4. Audit trail
      await supabase.from('payroll_audit_logs').insert({
        company_id: companyId,
        entity_type: 'country_configuration',
        entity_id: countryCode,
        action: 'activate',
        after_state: { country_code: countryCode },
        reason: 'Country activated via setup wizard',
      });

      // Refresh everything country-scoped
      await refreshCompany();
      qc.invalidateQueries();
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  };

  const Section = ({ title, children }) => (
    <div className="card p-5">
      <p className="text-sm font-semibold text-secondary-800 mb-3">{title}</p>
      {children}
    </div>
  );

  const List = ({ items, render }) => (
    <div className="divide-y divide-secondary-100 border border-secondary-100 rounded-lg max-h-96 overflow-y-auto">
      {items.length === 0 ? (
        <p className="p-4 text-sm text-secondary-400">Nothing configured for this country.</p>
      ) : items.map((it, i) => <div key={i} className="px-3 py-2 flex items-center gap-3 text-sm">{render(it)}</div>)}
    </div>
  );

  const stepKey = STEPS[step].key;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Country Setup Wizard</h2>
        <p className="text-sm text-secondary-500">
          Review the HR & payroll configuration for a country and activate it for your company.
          Labels, fields, documents, payroll components, statutory rules, leave and payslips all follow the active country.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <button key={s.key} onClick={() => i <= step && setStep(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${i === step ? 'bg-primary-600 text-white' : i < step ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-400'}`}>
            {i < step ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
            {s.label}
          </button>
        ))}
      </div>

      {done ? (
        <div className="card p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-success-50 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-success-600" />
          </div>
          <p className="font-semibold text-secondary-900">{country?.name} is now active for {company?.name}</p>
          <p className="text-sm text-secondary-500">
            Employee forms, documents, payroll components, statutory calculations, payslips and reports
            now follow the {country?.name} configuration ({country?.currency_code}).
          </p>
        </div>
      ) : (
        <>
          {stepKey === 'country' && (
            <Section title="Select operating country">
              <div className="max-w-md space-y-3">
                <Select value={countryCode} onChange={e => setCountryCode(e.target.value)}>
                  {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </Select>
                {country && (
                  <div className="p-3 bg-secondary-50 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-secondary-400">Currency</span><span className="font-medium">{country.currency_code} ({country.currency_decimals} decimals)</span></div>
                    <div className="flex justify-between"><span className="text-secondary-400">Date format</span><span className="font-medium">{country.date_format}</span></div>
                    <div className="flex justify-between"><span className="text-secondary-400">Timezone</span><span className="font-medium">{country.default_timezone}</span></div>
                  </div>
                )}
                {company?.country_code && company.country_code !== countryCode && (
                  <p className="text-xs text-warning-700 bg-warning-50 border border-warning-200 rounded-lg px-3 py-2">
                    Your company is currently set to {company.country_code}. Activating {countryCode} switches all
                    country-driven configuration — existing employee data is kept but validated against the new rules.
                  </p>
                )}
              </div>
            </Section>
          )}

          {stepKey === 'fields' && (
            <Section title={`Employee fields — ${country?.name}`}>
              <List items={fields} render={f => (
                <>
                  <span className="flex-1">{f.field_label} <span className="text-xs text-secondary-400 font-mono">{f.field_key}</span></span>
                  <Badge variant="default">{f.section}</Badge>
                  <Badge variant="info">{f.field_type}</Badge>
                  {f.is_required && <Badge variant="warning">required</Badge>}
                  {f.is_sensitive && <Badge variant="error">sensitive</Badge>}
                </>
              )} />
              <p className="text-xs text-secondary-400 mt-2">Customize fields in Admin → Custom Fields. The national ID field label and validation come from the country configuration.</p>
            </Section>
          )}

          {stepKey === 'address' && (
            <Section title={`Address format — ${country?.name}`}>
              <List items={Array.isArray(addressFormat?.fields) ? addressFormat.fields : []} render={f => (
                <>
                  <span className="flex-1">{f.label}</span>
                  {f.required && <Badge variant="warning">required</Badge>}
                  {f.type === 'select' && <Badge variant="info">{(f.options || []).length} options</Badge>}
                  {f.validation?.regex && <span className="text-xs font-mono text-secondary-400">{f.validation.regex}</span>}
                </>
              )} />
            </Section>
          )}

          {stepKey === 'documents' && (
            <Section title={`Document requirements — ${country?.name}`}>
              <List items={documents} render={d => (
                <>
                  <span className="flex-1">{d.document_name}{d.hint && <span className="block text-xs text-secondary-400">{d.hint}</span>}</span>
                  {d.is_mandatory && <Badge variant="warning">mandatory</Badge>}
                  {d.has_expiry && <Badge variant="info">expiry tracked</Badge>}
                  {d.applicable_when && <Badge variant="default">conditional</Badge>}
                </>
              )} />
            </Section>
          )}

          {stepKey === 'components' && (
            <Section title={`Payroll components — ${country?.name}`}>
              <List items={components} render={c => (
                <>
                  <span className="flex-1">{c.component_name} <span className="text-xs font-mono text-secondary-400">{c.component_code}</span></span>
                  <Badge variant="default">{c.component_type.replace('_', ' ')}</Badge>
                  <Badge variant={c.calculation_type === 'statutory' ? 'primary' : 'info'}>{c.calculation_type}</Badge>
                  {c.applicable_nationality && <Badge variant="warning">{c.applicable_nationality}</Badge>}
                </>
              )} />
            </Section>
          )}

          {stepKey === 'statutory' && (
            <Section title={`Statutory rates — ${country?.name}`}>
              <List items={statutoryRules} render={r => (
                <>
                  <span className="flex-1 font-mono text-xs">{r.module_code}.{r.rule_key}{r.applicable_to ? ` (${r.applicable_to})` : ''}</span>
                  <span className="font-mono text-xs font-semibold">{typeof r.rule_value === 'object' ? 'slab table' : String(r.rule_value)}</span>
                  <span className="text-xs text-secondary-400">{r.effective_from}</span>
                </>
              )} />
              <p className="text-xs text-secondary-400 mt-2">Rates are platform-managed legislation data with effective dates. Verify against official sources before first live payroll.</p>
            </Section>
          )}

          {stepKey === 'leave' && (
            <Section title={`Leave policies & holidays — ${country?.name}`}>
              <LeaveHolidayPreview countryCode={countryCode} />
            </Section>
          )}

          {stepKey === 'tax' && (
            <div className="space-y-4">
              <Section title={`Tax rules — ${country?.name}`}>
                <List items={taxRules} render={t => (
                  <>
                    <span className="flex-1">{t.tax_name} <span className="text-xs text-secondary-400">{t.tax_year}{t.regime ? ` · ${t.regime}` : ''}{t.jurisdiction ? ` · ${t.jurisdiction}` : ''}</span></span>
                    <Badge variant="info">{t.calculation_method}</Badge>
                    {t.tax_slabs?.length > 0 && <Badge variant="default">{t.tax_slabs.length} slabs</Badge>}
                  </>
                )} />
                {taxRules.length === 0 && <p className="text-xs text-secondary-400 mt-2">No personal income tax rules for this country.</p>}
              </Section>
              <Section title="End of service / gratuity">
                {eosbRule ? (
                  <div className="text-sm space-y-1">
                    <p className="font-medium">{eosbRule.rule_name}</p>
                    <p className="text-xs text-secondary-500">
                      Eligibility {eosbRule.eligibility_months} months · base {eosbRule.calculation_base} · divisor {eosbRule.day_divisor}
                      {eosbRule.nationality_dependency ? ` · ${eosbRule.nationality_dependency}` : ''}
                    </p>
                    {(eosbRule.tier_bands || []).map((b, i) => (
                      <p key={i} className="text-xs font-mono text-secondary-600">
                        {b.fromYears}–{b.toYears ?? '∞'} yrs: {b.daysPerYear} days/yr
                      </p>
                    ))}
                    {eosbRule.notes && <p className="text-xs text-secondary-400">{eosbRule.notes}</p>}
                  </div>
                ) : <p className="text-sm text-secondary-400">No EOSB rule configured.</p>}
              </Section>
            </div>
          )}

          {stepKey === 'review' && (
            <Section title={`Activate ${country?.name} for ${company?.name}`}>
              <div className="space-y-2 text-sm">
                {[
                  ['Employee fields', `${fields.length} country fields`],
                  ['Address format', addressFormat ? 'Configured' : 'Not configured'],
                  ['Document requirements', `${documents.length} documents (${documents.filter(d => d.is_mandatory).length} mandatory)`],
                  ['Payroll components', `${components.length} components (${components.filter(c => c.calculation_type === 'statutory').length} statutory)`],
                  ['Statutory rate rules', `${statutoryRules.length} rules`],
                  ['Tax rules', taxRules.length ? `${taxRules.length} rules` : 'No income tax'],
                  ['EOSB / gratuity', eosbRule ? eosbRule.rule_name : 'None'],
                  ['Currency', `${country?.currency_code} (${country?.currency_decimals} decimals)`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-secondary-50 pb-1.5">
                    <span className="text-secondary-400">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              {error && <p className="mt-3 text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2">{error}</p>}
            </Section>
          )}

          <div className="flex justify-between">
            <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="btn-secondary">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            {stepKey === 'review' ? (
              <button onClick={activate} disabled={activating} className="btn-primary">
                {activating ? 'Activating…' : `Activate ${country?.name}`} <Check className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="btn-primary">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LeaveHolidayPreview({ countryCode }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const year = new Date().getFullYear();
      const [leave, holidays] = await Promise.all([
        supabase.from('leave_policy_templates').select('*').eq('country_code', countryCode).eq('is_active', true),
        supabase.from('holiday_calendars').select('*').eq('country_code', countryCode).eq('year', year).order('start_date'),
      ]);
      if (!cancelled) setData({ leave: leave.data || [], holidays: holidays.data || [] });
    })();
    return () => { cancelled = true; };
  }, [countryCode]);
  if (!data) return <p className="text-sm text-secondary-400">Loading…</p>;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">Leave policies</p>
        <div className="divide-y divide-secondary-100 border border-secondary-100 rounded-lg">
          {data.leave.map(l => (
            <div key={l.id} className="px-3 py-2 flex items-center gap-2 text-sm">
              <span className="flex-1">{l.leave_name}</span>
              <span className="font-mono text-xs">{l.days_per_year}d/yr</span>
              {l.is_statutory && <Badge variant="primary">statutory</Badge>}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">Holidays ({new Date().getFullYear()})</p>
        <div className="divide-y divide-secondary-100 border border-secondary-100 rounded-lg max-h-72 overflow-y-auto">
          {data.holidays.map(h => (
            <div key={h.id} className="px-3 py-2 flex items-center gap-2 text-sm">
              <span className="flex-1">{h.name}</span>
              <span className="font-mono text-xs">{h.start_date}{h.end_date !== h.start_date ? ` → ${h.end_date}` : ''}</span>
              {h.is_tentative && <Badge variant="warning">tentative</Badge>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
