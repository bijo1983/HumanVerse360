import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useForm } from 'react-hook-form';
import {
  Crown, Building2, Users, CheckCircle, XCircle, Edit, RefreshCw,
  Plus, Trash2, ToggleLeft, ToggleRight, Save, Send, Loader2, AlertCircle, Info,
} from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { FormField, Select, Input, Textarea } from '../../components/ui/Form';
import { formatDate } from '../../lib/calculations';
import { MODULE_LABELS } from '../../lib/plans';
import CustomFieldsAdmin from './CustomFieldsAdmin';
import DatabaseSettings from '../settings/DatabaseSettings';

const ALL_MODULES = Object.keys(MODULE_LABELS);

const GCC_COUNTRIES = [
  { code: 'BH', name: 'Bahrain' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'JO', name: 'Jordan' },
  { code: 'EG', name: 'Egypt' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'OTHER', name: 'Other' },
];

const PAYMENT_COLORS = {
  paid: 'bg-success-50 text-success-700 border-success-200',
  unpaid: 'bg-warning-50 text-warning-700 border-warning-200',
  overdue: 'bg-error-50 text-error-700 border-error-200',
};

// ── Data hooks ────────────────────────────────────────────────────────────────

function useAllCompanies() {
  return useQuery({
    queryKey: ['admin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*, subscription_plans(id, name, code, price_bhd)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_plans').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

function useUpsertPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan) => {
      if (plan.id) {
        const { id, ...rest } = plan;
        const { error } = await supabase.from('subscription_plans').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subscription_plans').insert(plan);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-plans'] }),
  });
}

function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-plans'] }),
  });
}

function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }) => {
      const { error } = await supabase.from('companies').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-companies'] }),
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ['Companies', 'Subscription Plans', 'Custom Fields', 'Database Config', 'Platform Email'];

export default function AdminPage() {
  const [tab, setTab] = useState('Companies');
  const { data: companies = [], isLoading: loadingCompanies } = useAllCompanies();
  const { data: plans = [] } = useSubscriptionPlans();

  const totalRevenue = companies
    .filter(c => c.payment_status === 'paid')
    .reduce((sum, c) => sum + (c.subscription_plans?.price_bhd || 0), 0);

  const paid = companies.filter(c => c.payment_status === 'paid').length;
  const unpaid = companies.filter(c => c.payment_status !== 'paid').length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Platform Administration</h2>
          <p className="text-sm text-secondary-500">Manage subscriptions, plans, and companies</p>
        </div>
        <span className="text-xs bg-error-50 text-error-700 border border-error-200 px-3 py-1.5 rounded-lg font-semibold">
          Admin Access
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Building2 className="w-4 h-4 text-primary-500" />} label="Total Companies" value={companies.length} />
        <StatCard icon={<CheckCircle className="w-4 h-4 text-success-500" />} label="Paid" value={paid} valueClass="text-success-700" />
        <StatCard icon={<XCircle className="w-4 h-4 text-warning-500" />} label="Unpaid / Overdue" value={unpaid} valueClass="text-warning-700" />
        <StatCard icon={<Crown className="w-4 h-4 text-accent-500" />} label="Monthly Revenue" value={`BHD ${totalRevenue.toFixed(3)}`} valueClass="text-accent-700" />
      </div>

      <div className="border-b border-secondary-200">
        <nav className="flex gap-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-secondary-500 hover:text-secondary-800'
              }`}>{t}</button>
          ))}
        </nav>
      </div>

      {tab === 'Companies' && (
        <CompaniesTab companies={companies} plans={plans} loading={loadingCompanies} />
      )}
      {tab === 'Subscription Plans' && <PlansTab plans={plans} />}
      {tab === 'Custom Fields' && <CustomFieldsAdmin />}
      {tab === 'Database Config' && <DatabaseSettings />}
      {tab === 'Platform Email' && <PlatformSmtpTab />}
    </div>
  );
}

function StatCard({ icon, label, value, valueClass = 'text-secondary-900' }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<p className="text-xs text-secondary-500">{label}</p></div>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────

function CompaniesTab({ companies, plans, loading }) {
  const [editing, setEditing] = useState(null);

  const columns = [
    {
      header: 'Company', key: 'name',
      render: (v, row) => (
        <div>
          <p className="font-semibold text-secondary-800 text-sm">{v}</p>
          <p className="text-xs text-secondary-400">{row.email}</p>
          {row.cr_number && <p className="text-xs text-secondary-400">CR: {row.cr_number}</p>}
        </div>
      ),
    },
    { header: 'Industry', key: 'industry', render: v => <span className="text-sm">{v || '–'}</span> },
    {
      header: 'Plan', key: 'subscription_plans',
      render: v => v ? (
        <div className="flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-sm font-medium">{v.name}</span>
          <span className="text-xs text-secondary-400">BHD {v.price_bhd}</span>
        </div>
      ) : <span className="text-xs text-secondary-400">–</span>,
    },
    {
      header: 'Payment', key: 'payment_status',
      render: v => (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${PAYMENT_COLORS[v] || PAYMENT_COLORS.unpaid}`}>
          {v || 'unpaid'}
        </span>
      ),
    },
    {
      header: 'Status', key: 'subscription_status',
      render: v => (
        <span className={`text-xs font-medium capitalize ${v === 'active' ? 'text-success-600' : 'text-warning-600'}`}>
          {v || '–'}
        </span>
      ),
    },
    { header: 'Next Billing', key: 'next_billing_date', render: v => <span className="text-xs text-secondary-500">{formatDate(v) || '–'}</span> },
    { header: 'Registered', key: 'created_at', render: v => <span className="text-xs text-secondary-400">{formatDate(v)}</span> },
    {
      header: '', key: 'id',
      render: (_, row) => (
        <button onClick={() => setEditing(row)}
          className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600 transition-colors">
          <Edit className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="card">
        <Table columns={columns} data={companies} loading={loading} emptyMessage="No companies registered yet." />
      </div>
      {editing && <EditCompanyModal company={editing} plans={plans} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditCompanyModal({ company, plans, onClose }) {
  const updateCompany = useUpdateCompany();
  const [modalTab, setModalTab] = useState('subscription');

  const { register: regSub, handleSubmit: handleSub } = useForm({
    defaultValues: {
      subscription_plan_id: company.subscription_plan_id || '',
      subscription_status: company.subscription_status || 'active',
      payment_status: company.payment_status || 'unpaid',
      payment_notes: company.payment_notes || '',
      last_payment_date: company.last_payment_date || '',
      next_billing_date: company.next_billing_date || '',
    },
  });

  const { register: regOrg, handleSubmit: handleOrg } = useForm({
    defaultValues: {
      name: company.name || '',
      phone: company.phone || '',
      address: company.address || '',
      website: company.website || '',
      cr_number: company.cr_number || '',
      industry: company.industry || '',
      country: company.country || '',
      country_code: company.country_code || '',
    },
  });

  async function saveSub(data) {
    try {
      await updateCompany.mutateAsync({ id: company.id, ...data, last_payment_date: data.last_payment_date || null, next_billing_date: data.next_billing_date || null, subscription_plan_id: data.subscription_plan_id || null });
      onClose();
    } catch (e) { alert(e.message); }
  }

  async function saveOrg(data) {
    try {
      const countryName = GCC_COUNTRIES.find(c => c.code === data.country_code)?.name || data.country_code;
      await updateCompany.mutateAsync({ id: company.id, ...data, country: countryName });
      onClose();
    } catch (e) { alert(e.message); }
  }

  const INDUSTRIES = ['Construction','Retail & Trading','Healthcare','Hospitality & Food','Financial Services','Information Technology','Manufacturing','Oil & Gas','Education','Real Estate','Transportation & Logistics','Consulting','Other'];

  return (
    <Modal isOpen onClose={onClose} title={`Manage: ${company.name}`} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={modalTab === 'subscription' ? handleSub(saveSub) : handleOrg(saveOrg)}
            disabled={updateCompany.isPending} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${updateCompany.isPending ? 'animate-spin' : ''}`} />
            {updateCompany.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      }>

      {/* Modal Tabs */}
      <div className="flex gap-1 border-b border-secondary-200 -mx-6 px-6 mb-5">
        {[['subscription', 'Subscription & Billing'], ['org', 'Organization Config']].map(([key, label]) => (
          <button key={key} onClick={() => setModalTab(key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${modalTab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {modalTab === 'subscription' && (
        <div className="space-y-4">
          <div className="p-3 bg-secondary-50 rounded-lg border border-secondary-100 text-sm space-y-1.5">
            <InfoRow label="Company" value={company.name} />
            <InfoRow label="Email" value={company.email} />
            <InfoRow label="Country" value={company.country || '–'} />
            <InfoRow label="Registered" value={formatDate(company.created_at)} />
          </div>
          <FormField label="Subscription Plan">
            <Select {...regSub('subscription_plan_id')}>
              <option value="">Select plan...</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — BHD {p.price_bhd}/month</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Subscription Status">
              <Select {...regSub('subscription_status')}>
                {['active','suspended','cancelled','trial'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </Select>
            </FormField>
            <FormField label="Payment Status">
              <Select {...regSub('payment_status')}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Last Payment Date"><Input {...regSub('last_payment_date')} type="date" /></FormField>
            <FormField label="Next Billing Date"><Input {...regSub('next_billing_date')} type="date" /></FormField>
          </div>
          <FormField label="Payment Notes"><Textarea {...regSub('payment_notes')} rows={2} placeholder="Optional notes..." /></FormField>
        </div>
      )}

      {modalTab === 'org' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Company Name" required className="col-span-2">
              <Input {...regOrg('name', { required: true })} placeholder="Company Legal Name" />
            </FormField>
            <FormField label="Phone">
              <Input {...regOrg('phone')} placeholder="+973 XXXX XXXX" />
            </FormField>
            <FormField label="CR / License Number">
              <Input {...regOrg('cr_number')} placeholder="CR-XXXXXXX" />
            </FormField>
            <FormField label="Country" required>
              <Select {...regOrg('country_code')}>
                <option value="">Select country...</option>
                {GCC_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Industry">
              <Select {...regOrg('industry')}>
                <option value="">Select industry...</option>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </Select>
            </FormField>
            <FormField label="Website" className="col-span-2">
              <Input {...regOrg('website')} placeholder="https://company.com" />
            </FormField>
            <FormField label="Address" className="col-span-2">
              <Textarea {...regOrg('address')} rows={2} />
            </FormField>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Plans Tab ─────────────────────────────────────────────────────────────────

function PlansTab({ plans }) {
  const [editing, setEditing] = useState(null);
  const deletePlan = useDeletePlan();

  async function handleDelete(plan) {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    try { await deletePlan.mutateAsync(plan.id); } catch (e) { alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setEditing({})} className="btn-primary">
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {plans.map(plan => (
          <PlanCard key={plan.id} plan={plan}
            onEdit={() => setEditing(plan)}
            onDelete={() => handleDelete(plan)} />
        ))}
        {plans.length === 0 && (
          <p className="text-sm text-secondary-400 col-span-3 text-center py-8">No plans yet.</p>
        )}
      </div>

      {editing !== null && <PlanModal plan={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PlanCard({ plan, onEdit, onDelete }) {
  const modules = plan.modules || [];
  return (
    <div className={`card p-5 space-y-4 relative ${plan.is_popular ? 'ring-2 ring-primary-400' : ''}`}>
      {plan.is_popular && (
        <span className="absolute -top-2.5 left-4 text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full font-semibold">
          Popular
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-secondary-900">{plan.name}</p>
          <p className="text-xs text-secondary-500 mt-0.5 uppercase tracking-wide">{plan.code}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-primary-600 text-lg">
            {plan.price_bhd > 0 ? `BHD ${plan.price_bhd}` : 'Free'}
          </p>
          <p className="text-xs text-secondary-400">/ month</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-secondary-500 mb-2 uppercase tracking-wide">
          Modules ({modules.length}/{ALL_MODULES.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_MODULES.map(m => (
            <span key={m}
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                modules.includes(m)
                  ? 'bg-primary-50 text-primary-700 border-primary-200'
                  : 'bg-secondary-50 text-secondary-400 border-secondary-200 line-through'
              }`}>
              {MODULE_LABELS[m]}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-secondary-100">
        <div className="flex items-center gap-1.5 text-xs text-secondary-500">
          <Users className="w-3.5 h-3.5" />
          {!plan.max_employees || plan.max_employees >= 9999 ? 'Unlimited' : `Up to ${plan.max_employees}`} employees
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}
            className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600 transition-colors">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanModal({ plan, onClose }) {
  const upsertPlan = useUpsertPlan();
  const isNew = !plan.id;

  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      name: plan.name || '',
      code: plan.code || '',
      price_bhd: plan.price_bhd ?? 0,
      max_employees: plan.max_employees ?? 10,
      description: plan.description || '',
      is_active: plan.is_active ?? true,
      is_popular: plan.is_popular ?? false,
      sort_order: plan.sort_order ?? 99,
      modules: plan.modules || [],
    },
  });

  const watchedModules = watch('modules') || [];

  function toggleModule(m) {
    const current = watchedModules;
    setValue(
      'modules',
      current.includes(m) ? current.filter(x => x !== m) : [...current, m],
      { shouldDirty: true }
    );
  }

  async function onSubmit(data) {
    try {
      const payload = {
        ...data,
        price_bhd: parseFloat(data.price_bhd) || 0,
        max_employees: parseInt(data.max_employees) || null,
        sort_order: parseInt(data.sort_order) || 99,
      };
      if (plan.id) payload.id = plan.id;
      await upsertPlan.mutateAsync(payload);
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal isOpen onClose={onClose} title={isNew ? 'New Subscription Plan' : `Edit: ${plan.name}`} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={upsertPlan.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {upsertPlan.isPending ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Plan Name">
            <Input {...register('name', { required: true })} placeholder="e.g. Enterprise" />
          </FormField>
          <FormField label="Code (lowercase)">
            <Input {...register('code', { required: true })} placeholder="e.g. enterprise" />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Price (BHD/month)">
            <Input {...register('price_bhd')} type="number" step="0.001" min="0" />
          </FormField>
          <FormField label="Max Employees">
            <Input {...register('max_employees')} type="number" min="0" placeholder="0 = unlimited" />
          </FormField>
          <FormField label="Sort Order">
            <Input {...register('sort_order')} type="number" min="0" />
          </FormField>
        </div>

        <FormField label="Description">
          <Textarea {...register('description')} rows={2} />
        </FormField>

        <div>
          <p className="text-sm font-medium text-secondary-700 mb-2">Included Modules</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MODULES.map(m => {
              const active = watchedModules.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggleModule(m)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'
                  }`}>
                  {active
                    ? <ToggleRight className="w-4 h-4 flex-shrink-0" />
                    : <ToggleLeft className="w-4 h-4 flex-shrink-0" />}
                  <span>{MODULE_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-6 pt-2 border-t border-secondary-100">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_active')} className="rounded" />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_popular')} className="rounded" />
            Mark as Popular
          </label>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-secondary-500">{label}</span>
      <span className="font-medium text-secondary-800">{value}</span>
    </div>
  );
}

// ── Platform SMTP Tab ─────────────────────────────────────────────────────────

function PlatformSmtpTab() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['platform-smtp'],
    queryFn: async () => {
      const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from_email', 'smtp_from_name', 'smtp_secure', 'smtp_enabled'];
      const { data } = await supabase.from('platform_settings').select('key,value').in('key', keys);
      if (!data) return {};
      return Object.fromEntries(data.map(r => [r.key, r.value]));
    },
  });

  const { register, handleSubmit, watch, getValues } = useForm({ values: settings || {} });
  const smtpEnabled = watch('smtp_enabled');

  const save = useMutation({
    mutationFn: async (data) => {
      const rows = Object.entries(data).filter(([k]) => k !== '_test_to').map(([key, value]) => ({ key, value: String(value ?? '') }));
      for (const row of rows) {
        const { error } = await supabase.from('platform_settings')
          .upsert({ key: row.key, value: row.value }, { onConflict: 'key' });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-smtp'] }),
  });

  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    const vals = getValues();
    if (!vals.smtp_host || !vals.smtp_user || !vals.smtp_pass || !vals._test_to) {
      setTestResult({ success: false, steps: [], error: 'Fill in Host, Username, Password and Recipient Email before testing.', duration_ms: 0 });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          host: vals.smtp_host,
          port: parseInt(vals.smtp_port) || 587,
          user: vals.smtp_user,
          pass: vals.smtp_pass,
          from_email: vals.smtp_from_email,
          from_name: vals.smtp_from_name,
          secure: vals.smtp_secure === true || vals.smtp_secure === 'true',
          to_email: vals._test_to,
        }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, steps: [], error: e.message, duration_ms: 0 });
    } finally {
      setTesting(false);
    }
  }

  if (isLoading) return <div className="card p-8 text-center text-secondary-400">Loading...</div>;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(d => save.mutate(d))}>
        <div className="card p-6 space-y-6">
          <div>
            <p className="text-sm font-semibold text-secondary-800 mb-1">Platform Email (SMTP)</p>
            <p className="text-xs text-secondary-400">Used for sending OTP codes and verification emails during company sign-up.</p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-secondary-50 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('smtp_enabled')} className="w-4 h-4 rounded accent-primary-600" />
              <span className="text-sm font-medium text-secondary-700">Enable custom SMTP for platform emails</span>
            </label>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!smtpEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <FormField label="SMTP Host">
              <Input {...register('smtp_host')} placeholder="smtp.gmail.com" />
            </FormField>
            <FormField label="SMTP Port">
              <Input {...register('smtp_port')} type="number" placeholder="587" />
            </FormField>
            <FormField label="SMTP Username">
              <Input {...register('smtp_user')} placeholder="admin@humanverse360.com" />
            </FormField>
            <FormField label="SMTP Password">
              <Input {...register('smtp_pass')} type="password" placeholder="App password" />
            </FormField>
            <FormField label="From Email">
              <Input {...register('smtp_from_email')} type="email" placeholder="no-reply@humanverse360.com" />
            </FormField>
            <FormField label="From Name">
              <Input {...register('smtp_from_name')} placeholder="HumanVerse360" />
            </FormField>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input type="checkbox" {...register('smtp_secure')} id="platform_smtp_secure" className="w-4 h-4 rounded accent-primary-600" />
              <label htmlFor="platform_smtp_secure" className="text-sm text-secondary-700">Use TLS/SSL (recommended for port 465)</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button type="submit" disabled={save.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {save.isPending ? 'Saving...' : 'Save Platform Email Settings'}
          </button>
        </div>
        {save.isSuccess && <p className="text-sm text-success-600 text-right mt-1">Saved successfully.</p>}
        {save.isError && <p className="text-sm text-error-600 text-right mt-1">{save.error.message}</p>}
      </form>

      {/* ── Test Email Panel ──────────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-secondary-800 mb-1">Send Test Email</p>
          <p className="text-xs text-secondary-400">Validates connectivity, authentication, and delivery using the settings above (saved or unsaved).</p>
        </div>

        <div className="flex gap-3 items-end">
          <FormField label="Recipient Email" className="flex-1">
            <Input {...register('_test_to')} type="email" placeholder="you@example.com" />
          </FormField>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="btn-primary whitespace-nowrap"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Testing...' : 'Send Test Email'}
          </button>
        </div>

        {testResult && <SmtpTestResult result={testResult} />}
      </div>
    </div>
  );
}

function SmtpTestResult({ result }) {
  const stepIcons = {
    ok: <CheckCircle className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />,
    fail: <XCircle className="w-4 h-4 text-error-500 flex-shrink-0 mt-0.5" />,
    info: <Info className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5" />,
  };
  const stepRowClass = {
    ok: 'bg-success-50 border-success-100',
    fail: 'bg-error-50 border-error-100',
    info: 'bg-primary-50 border-primary-100',
  };

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${result.success ? 'bg-success-50 border-success-200' : 'bg-error-50 border-error-200'}`}>
        {result.success
          ? <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
          : <AlertCircle className="w-5 h-5 text-error-600 flex-shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${result.success ? 'text-success-800' : 'text-error-800'}`}>
            {result.success ? 'Test passed — Email delivered successfully' : 'Test failed'}
          </p>
          {result.error && <p className="text-xs mt-0.5 text-error-600">{result.error}</p>}
          <p className="text-xs text-secondary-400 mt-1">Completed in {result.duration_ms}ms</p>
        </div>
      </div>

      {/* Step-by-step debug log */}
      {result.steps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Diagnostic Steps</p>
          {result.steps.map((step, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${stepRowClass[step.status]}`}>
              {stepIcons[step.status]}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-secondary-800">{step.label}</p>
                {step.detail && <p className="text-secondary-500 mt-0.5 font-mono break-all">{step.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
