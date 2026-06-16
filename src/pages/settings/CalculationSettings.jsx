import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Play, Code, Variable } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';
import { evaluateFormula, formatCurrency } from '../../lib/calculations';

function useCalcSettings(category) {
  return useQuery({
    queryKey: ['calc-settings', category],
    queryFn: async () => {
      let q = supabase.from('calculation_settings').select('*').eq('is_active', true).order('sort_order');
      if (category) q = q.eq('category', category);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

const CATEGORIES = ['All', 'Leave', 'Payroll', 'Indemnity', 'Overtime', 'GOSI', 'Tax', 'Other'];

export default function CalculationSettings() {
  const [category, setCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [testingItem, setTestingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const qc = useQueryClient();

  const { data: settings = [], isLoading } = useCalcSettings(category !== 'All' ? category : undefined);

  const deleteItem = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('calculation_settings').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calc-settings'] }),
  });

  const columns = [
    { header: 'Name', key: 'name', render: (v, row) => (
      <div>
        <p className="font-medium text-secondary-800">{v}</p>
        <code className="text-xs text-secondary-400 font-mono">{row.code}</code>
      </div>
    )},
    { header: 'Category', key: 'category', render: v => <Badge variant="primary">{v}</Badge> },
    { header: 'Formula', key: 'formula', render: v => (
      <code className="text-xs bg-secondary-100 px-2 py-0.5 rounded font-mono text-secondary-700 block max-w-xs truncate">{v}</code>
    )},
    { header: 'Variables', key: 'variables', render: v => {
      const vars = Array.isArray(v) ? v : (typeof v === 'string' ? JSON.parse(v || '[]') : []);
      return vars.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {vars.map(va => <code key={va} className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">{va}</code>)}
        </div>
      ) : '–';
    }},
    { header: 'Example', key: 'example', render: v => <span className="text-xs text-secondary-400">{v || '–'}</span> },
    {
      header: 'Actions', key: 'id',
      render: (id, row) => (
        <div className="flex gap-1">
          <button onClick={() => setTestingItem(row)} className="p-1.5 bg-accent-50 text-accent-600 rounded hover:bg-accent-100" title="Test">
            <Play className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setEditingItem(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Calculation Settings</h2>
          <p className="text-sm text-secondary-500">Dynamic formula engine – configure all HR & payroll calculations</p>
        </div>
        <button onClick={() => { setEditingItem(null); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Formula
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl flex items-start gap-3">
        <Variable className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-primary-800">Formula Variables</p>
          <p className="text-primary-600 mt-0.5">Use any of these variables in your formulas: <code className="bg-primary-100 px-1 rounded">basic_salary</code>, <code className="bg-primary-100 px-1 rounded">gross_salary</code>, <code className="bg-primary-100 px-1 rounded">working_days</code>, <code className="bg-primary-100 px-1 rounded">ot_hours</code>, <code className="bg-primary-100 px-1 rounded">service_years</code>, <code className="bg-primary-100 px-1 rounded">leave_days</code>, and more.</p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${category === cat ? 'bg-primary-600 text-white' : 'bg-white border border-secondary-200 text-secondary-600 hover:bg-secondary-50'}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="card">
        <Table columns={columns} data={settings} loading={isLoading} emptyMessage="No formulas found." />
      </div>

      {showForm && <FormulaForm item={editingItem} onClose={() => { setShowForm(false); setEditingItem(null); }} />}
      {testingItem && <FormulaTestModal item={testingItem} onClose={() => setTestingItem(null)} />}
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => { await deleteItem.mutateAsync(deletingId); setDeletingId(null); }}
        loading={deleteItem.isPending}
        title="Delete Formula"
        message="Delete this calculation formula? Any dependent processes may be affected."
      />
    </div>
  );
}

function FormulaForm({ item, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, watch } = useForm({
    defaultValues: item ? {
      ...item,
      variables: Array.isArray(item.variables) ? item.variables.join(', ') : (typeof item.variables === 'string' ? JSON.parse(item.variables || '[]').join(', ') : ''),
    } : { category: 'Payroll', is_active: true },
  });

  const upsert = useMutation({
    mutationFn: async (data) => {
      const vars = data.variables ? data.variables.split(',').map(v => v.trim()).filter(Boolean) : [];
      const payload = { ...data, variables: vars, sort_order: data.sort_order || 0 };
      if (item) {
        const { error } = await supabase.from('calculation_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('calculation_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calc-settings'] }); onClose(); },
  });

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edit Formula' : 'Add Formula'} size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(d => upsert.mutate(d))} disabled={upsert.isPending} className="btn-primary">
            {upsert.isPending ? 'Saving...' : 'Save Formula'}
          </button>
        </div>
      }>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Formula Name" required>
          <Input {...register('name', { required: true })} placeholder="e.g. Overtime Rate (Normal)" />
        </FormField>
        <FormField label="Code" required hint="Unique identifier, no spaces">
          <Input {...register('code', { required: true })} placeholder="e.g. OT_NORMAL" className="font-mono" />
        </FormField>
        <FormField label="Category">
          <Select {...register('category')}>
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
          </Select>
        </FormField>
        <FormField label="Variables" hint="Comma-separated: basic_salary, ot_hours">
          <Input {...register('variables')} placeholder="basic_salary, ot_hours" className="font-mono" />
        </FormField>
        <FormField label="Formula" required className="sm:col-span-2" hint="Use JavaScript math expressions">
          <Textarea {...register('formula', { required: true })} placeholder="basic_salary * 0.07" rows={3} className="font-mono text-sm" />
        </FormField>
        <FormField label="Example" className="sm:col-span-2">
          <Input {...register('example')} placeholder="BHD 300 × 7% = BHD 21.00" />
        </FormField>
        <FormField label="Description" className="sm:col-span-2">
          <Textarea {...register('description')} placeholder="Describe what this formula calculates..." rows={2} />
        </FormField>
      </form>
    </Modal>
  );
}

function FormulaTestModal({ item, onClose }) {
  const vars = Array.isArray(item.variables)
    ? item.variables
    : (typeof item.variables === 'string' ? JSON.parse(item.variables || '[]') : []);

  const [values, setValues] = useState(Object.fromEntries(vars.map(v => [v, 0])));
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const test = () => {
    setError('');
    const numericValues = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, parseFloat(v) || 0]));
    const r = evaluateFormula(item.formula, numericValues);
    if (r === null) { setError('Formula error – check syntax'); setResult(null); }
    else setResult(r);
  };

  return (
    <Modal isOpen onClose={onClose} title={`Test: ${item.name}`} size="md"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Close</button><button onClick={test} className="btn-primary"><Play className="w-4 h-4" /> Run Test</button></div>}>
      <div className="space-y-4">
        <div className="p-3 bg-secondary-50 rounded-lg">
          <p className="text-xs text-secondary-400 mb-1">Formula</p>
          <code className="text-sm font-mono text-secondary-800">{item.formula}</code>
        </div>

        {vars.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-secondary-700">Test Values</p>
            {vars.map(v => (
              <FormField key={v} label={v}>
                <Input
                  type="number" step="any"
                  value={values[v] || 0}
                  onChange={e => setValues(prev => ({ ...prev, [v]: e.target.value }))}
                  className="font-mono"
                />
              </FormField>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-error-600 font-medium">{error}</p>}

        {result !== null && (
          <div className="p-4 bg-success-50 border border-success-200 rounded-xl text-center">
            <p className="text-xs text-success-600 mb-1">Result</p>
            <p className="text-2xl font-bold text-success-800">{typeof result === 'number' ? result.toFixed(3) : result}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
