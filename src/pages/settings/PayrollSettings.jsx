import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Settings2, Percent, Clock, Calendar, Save, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePayrollSettings, useUpsertPayrollSettings } from '../../hooks/usePayroll';
import { FormField, Input } from '../../components/ui/Form';

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
    </div>
  );
}
