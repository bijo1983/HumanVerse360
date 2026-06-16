import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import { Plus, Edit, Trash2, GripVertical, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { MODULE_LABELS } from '../../lib/plans';

const FIELD_TYPES = ['text', 'number', 'date', 'select', 'checkbox', 'textarea'];

const COUNTRIES = [
  { code: null, label: 'All Countries (Global)' },
  { code: 'BH', label: 'Bahrain' },
  { code: 'AE', label: 'UAE' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'KW', label: 'Kuwait' },
  { code: 'QA', label: 'Qatar' },
  { code: 'OM', label: 'Oman' },
  { code: 'IN', label: 'India' },
  { code: 'PH', label: 'Philippines' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'EG', label: 'Egypt' },
];

const COUNTRY_MAP = Object.fromEntries(COUNTRIES.map(c => [c.code, c.label]));

const SECTION_SUGGESTIONS = {
  employees: ['Personal', 'Employment', 'Documents', 'Banking', 'Salary'],
  leave: ['General'],
  payroll: ['General', 'Deductions'],
  indemnity: ['General'],
};

function useCustomFields() {
  return useQuery({
    queryKey: ['admin-custom-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('*')
        .order('module')
        .order('section')
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

function useUpsertField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (field) => {
      if (field.id) {
        const { id, ...rest } = field;
        const { error } = await supabase.from('custom_fields').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('custom_fields').insert(field);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-custom-fields'] }),
  });
}

function useDeleteField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('custom_fields').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-custom-fields'] }),
  });
}

function useAllCompanies() {
  return useQuery({
    queryKey: ['admin-companies-slim'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export default function CustomFieldsAdmin() {
  const { data: fields = [], isLoading } = useCustomFields();
  const { data: companies = [] } = useAllCompanies();
  const deleteField = useDeleteField();
  const [editing, setEditing] = useState(null);
  const [expandedModule, setExpandedModule] = useState(null);

  // Group by module
  const byModule = fields.reduce((acc, f) => {
    (acc[f.module] = acc[f.module] || []).push(f);
    return acc;
  }, {});

  async function handleDelete(field) {
    if (!confirm(`Delete field "${field.field_label}"? This will also remove all stored values for this field.`)) return;
    try { await deleteField.mutateAsync(field.id); } catch (e) { alert(e.message); }
  }

  const modules = Object.keys(MODULE_LABELS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-secondary-500">
            Define country- or company-specific fields that appear in HR module forms.
            Fields with no country/company scope apply globally.
          </p>
        </div>
        <button onClick={() => setEditing({})} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Field
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {modules.map(mod => {
            const modFields = byModule[mod] || [];
            const isOpen = expandedModule === mod;
            return (
              <div key={mod} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isOpen ? null : mod)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary-50 transition-colors"
                >
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-secondary-400" />
                    : <ChevronRight className="w-4 h-4 text-secondary-400" />}
                  <span className="font-semibold text-secondary-800 flex-1">{MODULE_LABELS[mod]}</span>
                  <span className="text-xs text-secondary-400 bg-secondary-100 px-2 py-0.5 rounded-full">
                    {modFields.length} field{modFields.length !== 1 ? 's' : ''}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-secondary-100">
                    {modFields.length === 0 ? (
                      <p className="text-sm text-secondary-400 text-center py-6">
                        No custom fields for this module yet.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-secondary-50">
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Label</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Key</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Section</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Type</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Scope</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Req</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary-500 uppercase tracking-wide">Status</th>
                            <th className="px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-secondary-100">
                          {modFields.map(f => {
                            const companyName = f.company_id
                              ? companies.find(c => c.id === f.company_id)?.name || f.company_id.slice(0, 8)
                              : null;
                            const scope = f.company_id
                              ? `Company: ${companyName}`
                              : f.country_code
                                ? COUNTRY_MAP[f.country_code] || f.country_code
                                : 'Global';
                            return (
                              <tr key={f.id} className={`hover:bg-secondary-50 ${!f.is_active ? 'opacity-50' : ''}`}>
                                <td className="px-5 py-3 font-medium text-secondary-800">{f.field_label}</td>
                                <td className="px-4 py-3 font-mono text-xs text-secondary-500">{f.field_key}</td>
                                <td className="px-4 py-3 text-secondary-600">{f.section}</td>
                                <td className="px-4 py-3">
                                  <span className="text-xs bg-secondary-100 text-secondary-600 px-2 py-0.5 rounded capitalize">
                                    {f.field_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    f.company_id
                                      ? 'bg-accent-50 text-accent-700'
                                      : f.country_code
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'bg-secondary-100 text-secondary-600'
                                  }`}>
                                    {scope}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {f.is_required
                                    ? <span className="text-xs text-error-600 font-semibold">Yes</span>
                                    : <span className="text-xs text-secondary-400">No</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium ${f.is_active ? 'text-success-600' : 'text-secondary-400'}`}>
                                    {f.is_active ? 'Active' : 'Disabled'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={() => setEditing(f)}
                                      className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600 transition-colors">
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => handleDelete(f)}
                                      className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    <div className="px-5 py-3 border-t border-secondary-100">
                      <button onClick={() => setEditing({ module: mod })}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add field to {MODULE_LABELS[mod]}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <FieldModal
          field={editing}
          companies={companies}
          onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function FieldModal({ field, companies, onClose }) {
  const upsert = useUpsertField();
  const isNew = !field.id;

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      module: field.module || 'employees',
      section: field.section || 'Personal',
      field_key: field.field_key || '',
      field_label: field.field_label || '',
      field_type: field.field_type || 'text',
      is_required: field.is_required ?? false,
      is_active: field.is_active ?? true,
      placeholder: field.placeholder || '',
      hint: field.hint || '',
      sort_order: field.sort_order ?? 0,
      country_code: field.country_code || '',
      company_id: field.company_id || '',
      options: field.options ? JSON.stringify(field.options) : '',
    },
  });

  const watchedModule = watch('module');
  const watchedType = watch('field_type');

  async function onSubmit(data) {
    try {
      const payload = {
        ...data,
        country_code: data.country_code || null,
        company_id: data.company_id || null,
        sort_order: parseInt(data.sort_order) || 0,
        options: data.field_type === 'select' && data.options
          ? (() => { try { return JSON.parse(data.options); } catch { return data.options.split('\n').map(s => s.trim()).filter(Boolean); } })()
          : null,
      };
      if (field.id) payload.id = field.id;
      await upsert.mutateAsync(payload);
      onClose();
    } catch (e) { alert(e.message); }
  }

  const sectionSuggestions = SECTION_SUGGESTIONS[watchedModule] || ['General'];

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'Add Custom Field' : `Edit: ${field.field_label}`} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={upsert.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {upsert.isPending ? 'Saving...' : 'Save Field'}
          </button>
        </div>
      }>
      <div className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Module">
            <Select {...register('module', { required: true })}>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Section / Tab">
            <Input {...register('section', { required: true })}
              placeholder="Personal"
              list="section-suggestions" />
            <datalist id="section-suggestions">
              {sectionSuggestions.map(s => <option key={s} value={s} />)}
            </datalist>
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Field Label" error={errors.field_label?.message}>
            <Input {...register('field_label', { required: 'Required' })} placeholder="CPR Number" />
          </FormField>
          <FormField label="Field Key (snake_case)" error={errors.field_key?.message}>
            <Input {...register('field_key', {
              required: 'Required',
              pattern: { value: /^[a-z_][a-z0-9_]*$/, message: 'lowercase & underscores only' },
            })} placeholder="cpr_number" />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Field Type">
            <Select {...register('field_type')}>
              {FIELD_TYPES.map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Sort Order">
            <Input {...register('sort_order')} type="number" min="0" />
          </FormField>
          <div className="flex flex-col gap-2 pt-5">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('is_required')} className="rounded" />
              Required
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" {...register('is_active')} className="rounded" />
              Active
            </label>
          </div>
        </div>

        {watchedType === 'select' && (
          <FormField label="Options (one per line or JSON array)" hint='e.g. Option A\nOption B  or  ["A","B"]'>
            <Textarea {...register('options')} rows={4} placeholder={"Option A\nOption B\nOption C"} />
          </FormField>
        )}

        <FormField label="Placeholder text">
          <Input {...register('placeholder')} placeholder="e.g. Enter your CPR number" />
        </FormField>

        <FormField label="Hint / Help text">
          <Input {...register('hint')} placeholder="Displayed below the field" />
        </FormField>

        <div className="p-3 bg-secondary-50 rounded-lg border border-secondary-100 space-y-3">
          <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">Scope</p>
          <p className="text-xs text-secondary-500">
            Apply to a specific country, a specific company, or leave both blank for all (global).
            Company-specific overrides country-specific.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Country">
              <Select {...register('country_code')}>
                {COUNTRIES.map(c => (
                  <option key={c.code ?? ''} value={c.code ?? ''}>{c.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Specific Company">
              <Select {...register('company_id')}>
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
      </div>
    </Modal>
  );
}
