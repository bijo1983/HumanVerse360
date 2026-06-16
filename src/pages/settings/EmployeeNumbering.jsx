import { useState } from 'react';
import { useEmployeeNumberConfig, useUpsertEmployeeNumberConfig, generateEmployeeId } from '../../hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';
import { FormField, Input, Select } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';
import { RefreshCw } from 'lucide-react';

export default function EmployeeNumbering() {
  const { companyId } = useAuth();
  const { data: config, isLoading } = useEmployeeNumberConfig(companyId);
  const upsert = useUpsertEmployeeNumberConfig(companyId);
  const { register, handleSubmit, watch, formState: { isDirty } } = useForm({
    values: config || { prefix: 'EMP', separator: '', include_year: false, include_month: false, pad_length: 4, starting_number: 1001 },
  });

  const watched = watch();

  if (isLoading) return <div className="card p-8 text-center text-secondary-400">Loading...</div>;

  return (
    <div className="max-w-xl space-y-4">
      <div className="card p-6 space-y-4">
        <h3 className="section-title">Employee ID Format</h3>

        <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl">
          <p className="text-xs text-primary-600 font-semibold mb-1">Preview</p>
          <p className="text-2xl font-bold text-primary-900 font-mono">
            {generateEmployeeId(watched, watched.starting_number)}
          </p>
          <p className="text-xs text-primary-500 mt-1">Next employee will get this ID (number increments automatically)</p>
        </div>

        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prefix" hint="e.g. EMP, HR, STF">
              <Input {...register('prefix')} placeholder="EMP" />
            </FormField>
            <FormField label="Separator">
              <Select {...register('separator')}>
                <option value="">None</option>
                <option value="-">Hyphen (-)</option>
                <option value="/">Slash (/)</option>
                <option value=".">Dot (.)</option>
                <option value="_">Underscore (_)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Include Year">
              <Select {...register('include_year', { setValueAs: v => v === 'true' || v === true })}>
                <option value="false">No</option>
                <option value="true">Yes (e.g. 2026)</option>
              </Select>
            </FormField>
            <FormField label="Include Month" hint="Requires year enabled">
              <Select {...register('include_month', { setValueAs: v => v === 'true' || v === true })}>
                <option value="false">No</option>
                <option value="true">Yes (e.g. 06)</option>
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Number Length" hint="e.g. 4 = 0001">
              <Input {...register('pad_length', { valueAsNumber: true })} type="number" min="1" max="8" />
            </FormField>
            <FormField label="Starting Number">
              <Input {...register('starting_number', { valueAsNumber: true })} type="number" min="1" />
            </FormField>
          </div>
        </form>

        <div className="flex justify-end">
          <button onClick={handleSubmit(async d => { try { await upsert.mutateAsync(d); } catch(e) { alert(e.message); } })}
            disabled={upsert.isPending}
            className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${upsert.isPending ? 'animate-spin' : ''}`} />
            {upsert.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      <div className="card p-4 bg-secondary-50">
        <p className="text-xs text-secondary-500">
          <strong>Note:</strong> Changing the configuration only affects new employees. Existing employee IDs are not updated.
          When adding a new employee and leaving the Employee ID field blank, the system will auto-generate an ID using this format.
        </p>
      </div>
    </div>
  );
}
