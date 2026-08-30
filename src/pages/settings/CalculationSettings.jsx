import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Play, Search, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';
import { evaluateFormula, formatCurrency } from '../../lib/calculations';
import { analyzeFormula } from '../../lib/formulaEngine';

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

// All available variables that can be used in formulas
const FORMULA_VARIABLES = [
  {
    group: 'Salary',
    vars: [
      { name: 'basic_salary', desc: 'Employee basic salary (BHD)', example: '300.000' },
      { name: 'gross_salary', desc: 'Total gross salary including allowances', example: '450.000' },
      { name: 'housing_allowance', desc: 'Monthly housing allowance (BHD)', example: '100.000' },
      { name: 'transport_allowance', desc: 'Monthly transport allowance (BHD)', example: '30.000' },
      { name: 'food_allowance', desc: 'Monthly food allowance (BHD)', example: '20.000' },
      { name: 'other_allowances', desc: 'Other monthly allowances (BHD)', example: '0.000' },
    ],
  },
  {
    group: 'Time',
    vars: [
      { name: 'days_in_month', desc: 'Actual calendar days in the reference month', example: '31' },
      { name: 'working_days', desc: 'Contracted working days per month', example: '26' },
      { name: 'daily_rate', desc: 'Daily rate = basic_salary / days_in_month', example: '9.677' },
      { name: 'hourly_rate', desc: 'Hourly rate = daily_rate / 8', example: '1.209' },
      { name: 'ot_hours', desc: 'Number of overtime hours', example: '10' },
    ],
  },
  {
    group: 'Leave',
    vars: [
      { name: 'leave_days', desc: 'Number of leave days applied', example: '5' },
      { name: 'annual_leave_balance', desc: 'Accrued annual leave balance (days)', example: '18' },
      { name: 'unused_leave', desc: 'Unused leave days at end of service', example: '12' },
      { name: 'leave_salary', desc: 'Leave pay = (basic_salary / days_in_month) * leave_days', example: '48.387' },
    ],
  },
  {
    group: 'Service',
    vars: [
      { name: 'service_years', desc: 'Completed years of service', example: '3' },
      { name: 'service_months', desc: 'Total months of service', example: '38' },
      { name: 'service_days', desc: 'Total calendar days of service', example: '1155' },
    ],
  },
  {
    group: 'GOSI',
    vars: [
      { name: 'gosi_employee', desc: 'Employee GOSI deduction (Bahraini 8%, Expat 1%)', example: '24.000' },
      { name: 'gosi_employer', desc: 'Employer GOSI contribution (Bahraini 13%, Expat 3%)', example: '39.000' },
      { name: 'nationality', desc: 'Employee nationality: "Bahraini" or "Expat"', example: '"Bahraini"' },
    ],
  },
  {
    group: 'Indemnity',
    vars: [
      { name: 'indemnity_amount', desc: 'Calculated end-of-service indemnity (BHD)', example: '1350.000' },
      { name: 'termination_type', desc: '"Termination" or "Resignation"', example: '"Termination"' },
      { name: 'notice_pay_days', desc: 'Notice period days (14 or 30)', example: '30' },
    ],
  },
  {
    group: 'Payroll',
    vars: [
      { name: 'net_salary', desc: 'Net salary after all deductions', example: '376.000' },
      { name: 'total_deductions', desc: 'Sum of all deductions for the month', example: '74.000' },
      { name: 'total_allowances', desc: 'Sum of all allowances for the month', example: '150.000' },
      { name: 'tax_amount', desc: 'Income tax amount (if applicable)', example: '0.000' },
    ],
  },
];

export default function CalculationSettings() {
  const [category, setCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [testingItem, setTestingItem] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showVarPanel, setShowVarPanel] = useState(true);
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

      {/* Variable Reference Panel */}
      <div className="card">
        <button
          onClick={() => setShowVarPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-secondary-800 hover:bg-secondary-50 transition-colors rounded-xl">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded flex items-center justify-center text-xs font-bold">{'{}'}</span>
            Formula Variable Reference
          </span>
          {showVarPanel ? <ChevronUp className="w-4 h-4 text-secondary-400" /> : <ChevronDown className="w-4 h-4 text-secondary-400" />}
        </button>
        {showVarPanel && <VariableReferencePanel />}
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

function VariableReferencePanel() {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');

  const copy = (name) => {
    navigator.clipboard.writeText(name).catch(() => {});
    setCopied(name);
    setTimeout(() => setCopied(''), 1500);
  };

  const q = search.toLowerCase();
  const filtered = FORMULA_VARIABLES.map(group => ({
    ...group,
    vars: group.vars.filter(v => !q || v.name.includes(q) || v.desc.toLowerCase().includes(q)),
  })).filter(g => g.vars.length > 0);

  return (
    <div className="border-t border-secondary-100 p-4 space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
        <input
          type="text"
          placeholder="Search variables..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-secondary-400 text-center py-4">No matching variables found.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-2">{group.group}</p>
            <div className="space-y-1">
              {group.vars.map(v => (
                <button
                  key={v.name}
                  onClick={() => copy(v.name)}
                  title={`Copy: ${v.name}`}
                  className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-all text-left group">
                  <code className="text-xs font-mono text-primary-700 bg-primary-50 group-hover:bg-primary-100 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">{v.name}</code>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-secondary-600 leading-tight">{v.desc}</p>
                    <p className="text-xs text-secondary-400 mt-0.5 font-mono">e.g. {v.example}</p>
                  </div>
                  <span className="flex-shrink-0 text-secondary-300 group-hover:text-primary-500 mt-0.5">
                    {copied === v.name ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-secondary-400">Click any variable to copy its name to clipboard, then paste it into your formula.</p>
    </div>
  );
}

function FormulaForm({ item, onClose }) {
  const qc = useQueryClient();
  const formulaRef = useRef(null);
  const { register, handleSubmit, watch, setValue, getValues } = useForm({
    defaultValues: item ? {
      ...item,
      variables: Array.isArray(item.variables) ? item.variables.join(', ') : (typeof item.variables === 'string' ? JSON.parse(item.variables || '[]').join(', ') : ''),
    } : { category: 'Payroll', is_active: true },
  });

  const upsert = useMutation({
    mutationFn: async (data) => {
      // Validate the formula against the sandboxed engine before saving —
      // anything that doesn't parse here won't evaluate at payroll time.
      let analysis = null;
      if (data.formula) {
        try {
          analysis = analyzeFormula(data.formula);
        } catch (err) {
          throw new Error(`Formula error: ${err.message}`);
        }
      }
      const vars = data.variables ? data.variables.split(',').map(v => v.trim()).filter(Boolean) : [];
      const payload = { ...data, variables: vars, sort_order: data.sort_order || 0 };
      if (item) {
        const { error } = await supabase.from('calculation_settings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('calculation_settings').insert(payload);
        if (error) throw error;
      }
      // Record a new formula version (audit trail; approval via maker-checker)
      if (data.formula && data.code) {
        const { data: existing } = await supabase
          .from('formula_versions')
          .select('version_number, formula_expression')
          .eq('setting_code', data.code)
          .order('version_number', { ascending: false })
          .limit(1);
        const last = existing?.[0];
        if (!last || last.formula_expression !== data.formula) {
          const { data: userData } = await supabase.auth.getUser();
          await supabase.from('formula_versions').insert({
            setting_code: data.code,
            version_number: (last?.version_number || 0) + 1,
            formula_expression: data.formula,
            variables_used: analysis?.variables || vars,
            approval_status: 'pending_approval',
            change_reason: item ? 'Formula updated' : 'Formula created',
            created_by: userData?.user?.id || null,
          });
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calc-settings'] }); onClose(); },
  });

  const insertVariable = (varName) => {
    const current = getValues('formula') || '';
    const el = formulaRef.current;
    if (el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + varName + current.slice(end);
      setValue('formula', next, { shouldDirty: true });
      setTimeout(() => { el.focus(); el.setSelectionRange(start + varName.length, start + varName.length); }, 0);
    } else {
      setValue('formula', current ? `${current} ${varName}` : varName);
    }
    // Auto-add to variables list
    const currentVars = getValues('variables') || '';
    const varList = currentVars.split(',').map(v => v.trim()).filter(Boolean);
    if (!varList.includes(varName)) {
      setValue('variables', [...varList, varName].join(', '));
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={item ? 'Edit Formula' : 'Add Formula'} size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(d => upsert.mutate(d))} disabled={upsert.isPending} className="btn-primary">
            {upsert.isPending ? 'Saving...' : 'Save Formula'}
          </button>
        </div>
      }>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Form fields */}
        <form className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <FormField label="Variables" hint="Auto-filled when you click variables below">
            <Input {...register('variables')} placeholder="basic_salary, ot_hours" className="font-mono" />
          </FormField>
          <FormField label="Formula" required className="sm:col-span-2" hint="Use JavaScript math expressions">
            <Textarea
              {...register('formula', { required: true })}
              ref={(el) => { register('formula').ref(el); formulaRef.current = el; }}
              placeholder="basic_salary * 0.07"
              rows={3}
              className="font-mono text-sm"
            />
          </FormField>
          <FormField label="Example" className="sm:col-span-2">
            <Input {...register('example')} placeholder="BHD 300 × 7% = BHD 21.00" />
          </FormField>
          <FormField label="Description" className="sm:col-span-2">
            <Textarea {...register('description')} placeholder="Describe what this formula calculates..." rows={2} />
          </FormField>
        </form>

        {/* Inline variable picker */}
        <div className="lg:col-span-2 border border-secondary-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-3 py-2 bg-secondary-50 border-b border-secondary-200 text-xs font-semibold text-secondary-600 uppercase tracking-wider">
            Click to insert variable
          </div>
          <InlineVariablePicker onInsert={insertVariable} />
        </div>
      </div>
    </Modal>
  );
}

function InlineVariablePicker({ onInsert }) {
  const [search, setSearch] = useState('');
  const q = search.toLowerCase();
  const filtered = FORMULA_VARIABLES.map(g => ({
    ...g,
    vars: g.vars.filter(v => !q || v.name.includes(q) || v.desc.toLowerCase().includes(q)),
  })).filter(g => g.vars.length > 0);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-2 border-b border-secondary-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary-400" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-secondary-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-3">
        {filtered.map(group => (
          <div key={group.group}>
            <p className="text-xs font-semibold text-secondary-400 uppercase tracking-wider px-1 mb-1">{group.group}</p>
            <div className="flex flex-wrap gap-1">
              {group.vars.map(v => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onInsert(v.name)}
                  title={v.desc}
                  className="px-2 py-1 text-xs font-mono bg-primary-50 text-primary-700 rounded hover:bg-primary-100 hover:text-primary-900 border border-primary-100 hover:border-primary-300 transition-all">
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-secondary-400 text-center py-4">No matches</p>}
      </div>
    </div>
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
