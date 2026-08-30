import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Settings2, Percent, Clock, Calendar, Save, Info, Layers, Edit, Plus, FileDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePayrollSettings, useUpsertPayrollSettings, usePayrollComponents, useSaveCompanyComponent, useModuleSettings, useSaveModuleSettings } from '../../hooks/usePayroll';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { FormField, Input, Select } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';

function PctInput({ label, hint, ...props }) {
  return (
    <FormField label={label} hint={hint}>
      <div className="relative">
        <Input type="number" step="0.01" min="0" max="100" {...props} className="pr-8" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-sm"><Percent className="w-3.5 h-3.5" /></span>
      </div>
    </FormField>
  );
}

export default function PayrollSettings() {
  const { companyId } = useAuth();
  const { data: settings, isLoading } = usePayrollSettings(companyId);
  const upsert = useUpsertPayrollSettings(companyId);

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm({ defaultValues: settings });

  useEffect(() => { if (settings) reset(settings); }, [settings, reset]);

  const onSubmit = async (data) => {
    try {
      await upsert.mutateAsync({
        bahraini_employee_gosi_pct: Number(data.bahraini_employee_gosi_pct),
        bahraini_employer_gosi_pct: Number(data.bahraini_employer_gosi_pct),
        expat_employee_gosi_pct:    Number(data.expat_employee_gosi_pct),
        expat_employer_gosi_pct:    Number(data.expat_employer_gosi_pct),
        working_days_per_month:     Number(data.working_days_per_month),
        ot_rate_normal:             Number(data.ot_rate_normal),
        ot_rate_holiday:            Number(data.ot_rate_holiday),
      });
    } catch (e) { alert(e.message); }
  };

  if (isLoading) return <div className="p-8 text-center text-secondary-400">Loading settings…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Payroll Settings</h2>
        <p className="text-sm text-secondary-500">Configure GOSI contribution rates, overtime multipliers, and working days used across payroll calculations.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Bahraini GOSI */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-secondary-900">GOSI – Bahraini Nationals</h3>
              <p className="text-xs text-secondary-500">Pension + Unemployment Insurance (Social Insurance Organisation)</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PctInput
              label="Employee Contribution"
              hint="Default: 8% (7% pension + 1% unemployment)"
              {...register('bahraini_employee_gosi_pct')}
            />
            <PctInput
              label="Employer Contribution"
              hint="Default: 13% (12% pension + 1% unemployment)"
              {...register('bahraini_employer_gosi_pct')}
            />
          </div>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Applied on <strong>basic salary only</strong>. Bahrainis are also entitled to Article 116 end-of-service indemnity in addition to GOSI pension.
          </div>
        </div>

        {/* Expat GOSI */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
              <Settings2 className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-secondary-900">GOSI – Expat Employees</h3>
              <p className="text-xs text-secondary-500">Work Injury Insurance only</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <PctInput
              label="Employee Contribution"
              hint="Default: 1% (work injury)"
              {...register('expat_employee_gosi_pct')}
            />
            <PctInput
              label="Employer Contribution"
              hint="Default: 3% (work injury)"
              {...register('expat_employer_gosi_pct')}
            />
          </div>
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            Expats are not covered by pension or unemployment insurance. Article 116 end-of-service indemnity is fully payable by the employer.
          </div>
        </div>

        {/* Overtime & working days */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-green-600" />
            </div>
            <h3 className="font-semibold text-secondary-900">Overtime & Working Days</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Normal OT Multiplier" hint="Default: 1.25× (Bahrain Labor Law)">
              <div className="relative">
                <Input type="number" step="0.01" min="1" max="3" {...register('ot_rate_normal')} className="pr-6" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-xs">×</span>
              </div>
            </FormField>
            <FormField label="Holiday OT Multiplier" hint="Default: 1.5× (Bahrain Labor Law)">
              <div className="relative">
                <Input type="number" step="0.01" min="1" max="3" {...register('ot_rate_holiday')} className="pr-6" />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary-400 text-xs">×</span>
              </div>
            </FormField>
            <FormField label="Working Days / Month" hint="Used for prorating. Default: 26">
              <div className="relative">
                <Input type="number" step="1" min="20" max="31" {...register('working_days_per_month')} className="pr-8" />
                <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400" />
              </div>
            </FormField>
          </div>
          <div className="mt-3 p-3 bg-secondary-50 border border-secondary-200 rounded-lg text-xs text-secondary-600">
            OT amount = (Basic Salary ÷ (Calendar Days × 8)) × OT Hours × Multiplier. Calendar days are taken from the actual payroll month.
          </div>
        </div>

        {/* Calculation preview */}
        <div className="card p-5 bg-secondary-50">
          <h4 className="font-semibold text-secondary-700 text-sm mb-3">How These Rates Apply</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Bahraini – Employee GOSI', formula: 'Basic × Bahraini Employee %', example: 'BHD 300 × 8% = BHD 24.000', color: 'blue' },
              { label: 'Bahraini – Employer GOSI', formula: 'Basic × Bahraini Employer %', example: 'BHD 300 × 13% = BHD 39.000', color: 'blue' },
              { label: 'Expat – Employee GOSI', formula: 'Basic × Expat Employee %', example: 'BHD 300 × 1% = BHD 3.000', color: 'amber' },
              { label: 'Expat – Employer GOSI', formula: 'Basic × Expat Employer %', example: 'BHD 300 × 3% = BHD 9.000', color: 'amber' },
            ].map(({ label, formula, example, color }) => (
              <div key={label} className={`p-3 rounded-lg border ${color === 'blue' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-xs font-semibold ${color === 'blue' ? 'text-blue-700' : 'text-amber-700'}`}>{label}</p>
                <code className="text-xs text-secondary-600">{formula}</code>
                <p className="text-xs text-secondary-500 mt-1">{example}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={upsert.isPending || !isDirty} className="btn-primary">
            <Save className="w-4 h-4" />
            {upsert.isPending ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      <PayrollComponentsCard companyId={companyId} />
      <StatutoryFileSettingsCard companyId={companyId} />
    </div>
  );
}

// Employer-identifying settings needed to generate statutory compliance
// files (WPS SIF for AE/BH, PF ECR context for IN) — stored on
// company_statutory_modules.settings, not on the employee record.
function StatutoryFileSettingsCard({ companyId }) {
  const { config } = useCountryConfig();
  const countryCode = config.countryCode;
  const moduleCode = countryCode === 'IN' ? 'PF' : 'WPS';
  const isWps = moduleCode === 'WPS';
  const applicable = config.flags.wps || countryCode === 'IN';

  const { data: settings, isLoading } = useModuleSettings(companyId, countryCode, moduleCode);
  const save = useSaveModuleSettings(companyId, countryCode, moduleCode);
  const { register, handleSubmit, reset, formState: { isDirty } } = useForm({ values: settings || {} });

  useEffect(() => { if (settings) reset(settings); }, [settings, reset]);

  if (!applicable) return null;
  if (isLoading) return null;

  const onSubmit = async data => {
    try { await save.mutateAsync(data); } catch (e) { alert(e.message); }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <FileDown className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-secondary-900">
            {isWps ? 'WPS File Settings' : 'PF Establishment Settings'}
          </h3>
          <p className="text-xs text-secondary-500">
            {isWps
              ? 'Employer details required to generate the Wage Protection System Salary Information File (SIF) for your bank'
              : 'Used to compute the PF wage base shown in the Electronic Challan cum Return (ECR) export'}
          </p>
        </div>
      </div>
      {isWps ? (
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Employer Name (as registered with WPS)"><Input {...register('employerName')} /></FormField>
          <FormField label="WPS Establishment / Employer Unique ID"><Input {...register('wpsEstablishmentId')} /></FormField>
          <FormField label="Bank Short Name / WPS Agent"><Input {...register('bankShortName')} placeholder="e.g. ADCB, BBK" /></FormField>
          <FormField label="Employer Bank Account / IBAN"><Input {...register('employerAccountOrIban')} /></FormField>
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={save.isPending || !isDirty} className="btn-primary">
              <Save className="w-4 h-4" /> {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-secondary-500">
          PF wage base and contribution split are computed automatically from the country statutory rate rules.
          No additional employer settings are required.
        </p>
      )}
      <p className="mt-3 text-xs text-secondary-400 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2">
        {isWps
          ? 'Confirm the exact field order and agent codes with your WPS onboarding bank before your first live submission — some banks customize trailing fields.'
          : 'This is the standard EPFO ECR v2.0 layout.'}
      </p>
    </div>
  );
}

const COMPONENT_TYPE_LABELS = {
  earning: 'Earnings',
  deduction: 'Deductions',
  employer_contribution: 'Employer Contributions',
  provision: 'Provisions',
};

// Country-scoped payroll component catalogue with company-level overrides
function PayrollComponentsCard({ companyId }) {
  const { company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  const { config } = useCountryConfig();
  const { data: components = [], isLoading } = usePayrollComponents(countryCode, companyId);
  const save = useSaveCompanyComponent(companyId, countryCode);
  const [editing, setEditing] = useState(null); // component row or 'new'

  const grouped = components.reduce((acc, c) => {
    (acc[c.component_type] = acc[c.component_type] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-secondary-900">Payroll Components — {config.countryName}</h3>
            <p className="text-xs text-secondary-500">
              Country template components with company overrides. Statutory components are calculated by the {config.countryName} statutory engine.
            </p>
          </div>
        </div>
        <button onClick={() => setEditing('new')} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Add Component</button>
      </div>

      {isLoading ? (
        <p className="text-sm text-secondary-400 py-4 text-center">Loading components…</p>
      ) : (
        <div className="space-y-5">
          {Object.entries(COMPONENT_TYPE_LABELS).map(([type, label]) => (
            (grouped[type] || []).length > 0 && (
              <div key={type}>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">{label}</p>
                <div className="divide-y divide-secondary-100 border border-secondary-100 rounded-lg">
                  {grouped[type].map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-secondary-800">
                          {c.component_name} <span className="text-xs text-secondary-400 font-mono">{c.component_code}</span>
                        </p>
                        {c.calculation_type === 'formula' && c.formula && (
                          <p className="text-xs text-secondary-400 font-mono truncate">{c.formula}</p>
                        )}
                      </div>
                      <Badge variant={c.calculation_type === 'statutory' ? 'primary' : 'default'}>{c.calculation_type}</Badge>
                      {c.applicable_nationality && <Badge variant="info">{c.applicable_nationality}</Badge>}
                      {c.company_id ? <Badge variant="warning">override</Badge> : <Badge variant="default">template</Badge>}
                      <button onClick={() => setEditing(c)}
                        className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {editing && (
        <ComponentEditModal
          component={editing === 'new' ? null : editing}
          onSave={async fields => {
            try {
              await save.mutateAsync(fields);
              setEditing(null);
            } catch (e) { alert(e.message); }
          }}
          saving={save.isPending}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ComponentEditModal({ component, onSave, saving, onClose }) {
  const isTemplate = component && !component.company_id;
  const { register, handleSubmit, watch } = useForm({
    defaultValues: component || {
      component_type: 'earning',
      calculation_type: 'fixed',
      is_taxable: true,
      is_active: true,
      calculation_order: 100,
      default_value: 0,
    },
  });
  const calcType = watch('calculation_type');

  function submit(data) {
    onSave({
      id: component?.id,
      isTemplateOverride: isTemplate,
      component_code: data.component_code?.toUpperCase().replace(/\s+/g, '_'),
      component_name: data.component_name,
      component_type: data.component_type,
      calculation_type: data.calculation_type,
      formula: data.calculation_type === 'formula' ? data.formula : null,
      default_value: Number(data.default_value) || 0,
      is_taxable: !!data.is_taxable,
      is_active: !!data.is_active,
      calculation_order: Number(data.calculation_order) || 100,
    });
  }

  const statutory = component?.calculation_type === 'statutory';

  return (
    <Modal isOpen onClose={onClose} title={component ? `Edit ${component.component_name}` : 'Add Component'} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(submit)} disabled={saving || statutory} className="btn-primary">
            {saving ? 'Saving…' : isTemplate ? 'Save as Company Override' : 'Save'}
          </button>
        </div>
      }>
      {statutory ? (
        <p className="text-sm text-secondary-500 p-2">
          This is a statutory component calculated by the country statutory engine
          (<span className="font-mono text-xs">{component.statutory_function}</span>).
          Its rates are maintained in the country statutory rules, not editable here.
        </p>
      ) : (
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Code" required>
            <Input {...register('component_code', { required: true })} placeholder="SHIFT_ALW" disabled={!!component} />
          </FormField>
          <FormField label="Name" required>
            <Input {...register('component_name', { required: true })} placeholder="Shift Allowance" />
          </FormField>
          <FormField label="Type">
            <Select {...register('component_type')} disabled={!!component}>
              <option value="earning">Earning</option>
              <option value="deduction">Deduction</option>
              <option value="employer_contribution">Employer Contribution</option>
              <option value="provision">Provision</option>
            </Select>
          </FormField>
          <FormField label="Calculation">
            <Select {...register('calculation_type')}>
              <option value="fixed">Fixed amount</option>
              <option value="formula">Formula</option>
            </Select>
          </FormField>
          {calcType === 'formula' ? (
            <FormField label="Formula" className="sm:col-span-2" hint="Uses payroll variables, e.g. BASIC / WORKING_DAYS * 2">
              <Input {...register('formula')} placeholder="BASIC * 0.10" className="font-mono" />
            </FormField>
          ) : (
            <FormField label="Default Value">
              <Input {...register('default_value')} type="number" step="0.001" />
            </FormField>
          )}
          <FormField label="Calculation Order" hint="Lower runs first">
            <Input {...register('calculation_order')} type="number" />
          </FormField>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_taxable')} className="rounded" /> Taxable</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('is_active')} className="rounded" /> Active</label>
          </div>
        </form>
      )}
    </Modal>
  );
}
