import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Save, Copy, ExternalLink, CheckCheck } from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';
import { useDepartments, usePositions } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import LookupSettings from './LookupSettings';
import EmployeeNumbering from './EmployeeNumbering';
import UserManagement from './UserManagement';
import ImageUploadCrop from '../../components/ui/ImageUploadCrop';

const GCC_COUNTRIES = [
  { code: 'BH', name: 'Bahrain' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
];

const TABS = [
  { key: 'company', label: 'Company Profile' },
  { key: 'smtp', label: 'Email / SMTP' },
  { key: 'leave-config', label: 'Leave Config' },
  { key: 'departments', label: 'Departments' },
  { key: 'positions', label: 'Positions' },
  { key: 'salary-components', label: 'Salary Components' },
  { key: 'lookups', label: 'Lookup Lists' },
  { key: 'emp-numbering', label: 'Employee Numbering' },
  { key: 'users', label: 'Users & Access' },
];

export default function GeneralSettings() {
  const { companyId } = useAuth();
  const [tab, setTab] = useState('company');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Organization Settings</h2>
        <p className="text-sm text-secondary-500">Manage company profile, email, leave configuration, and more</p>
      </div>
      <div className="flex gap-1 border-b border-secondary-200 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'company' && <CompanyProfileTab companyId={companyId} />}
      {tab === 'smtp' && <SmtpConfigTab companyId={companyId} />}
      {tab === 'leave-config' && <LeaveConfigTab />}
      {tab === 'departments' && <DepartmentsTab companyId={companyId} />}
      {tab === 'positions' && <PositionsTab companyId={companyId} />}
      {tab === 'salary-components' && <SalaryComponentsTab />}
      {tab === 'lookups' && <LookupSettings />}
      {tab === 'emp-numbering' && <EmployeeNumbering />}
      {tab === 'users' && <UserManagement />}
    </div>
  );
}

function CompanyProfileTab({ companyId }) {
  const qc = useQueryClient();
  const { data: company, isLoading } = useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').eq('id', companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { register, handleSubmit, watch, setValue, formState: { isDirty } } = useForm({ values: company || {} });
  const [logoUrl, setLogoUrl] = useState('');
  // Sync logoUrl from react-hook-form values when company loads
  const watchedLogo = watch('logo_url');
  const effectiveLogo = logoUrl || watchedLogo || '';

  const save = useMutation({
    mutationFn: async (data) => {
      const countryObj = GCC_COUNTRIES.find(c => c.code === data.country_code);
      const payload = { ...data, logo_url: effectiveLogo || data.logo_url || null };
      if (countryObj) payload.country = countryObj.name;
      const { error } = await supabase.from('companies').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-profile', companyId] }),
  });

  if (isLoading) return <div className="card p-8 text-center text-secondary-400">Loading...</div>;

  return (
    <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4">
      <div className="card p-6 space-y-6">
        <div className="flex items-start gap-5">
          <ImageUploadCrop
            value={effectiveLogo}
            onChange={url => { setLogoUrl(url); setValue('logo_url', url, { shouldDirty: true }); }}
            bucket="company-logos"
            storagePath={companyId}
            aspect={undefined}
            shape="rect"
            label="Upload Logo"
            previewClass="w-24 h-24"
          />
          <div className="flex-1 pt-1">
            <p className="text-sm font-medium text-secondary-700">Company Logo</p>
            <p className="text-xs text-secondary-400 mt-0.5 leading-relaxed">
              Upload from your computer. After selecting, you can crop as needed.
              The logo appears on salary slips and the login page.
            </p>
            {effectiveLogo && (
              <button
                type="button"
                onClick={() => { setLogoUrl(''); setValue('logo_url', '', { shouldDirty: true }); }}
                className="text-xs text-error-500 hover:text-error-700 mt-2 transition-colors"
              >
                Remove logo
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-secondary-100 pt-4">
          <FormField label="Company Name" required>
            <Input {...register('name', { required: true })} />
          </FormField>
          <FormField label="CR Number">
            <Input {...register('cr_number')} placeholder="Commercial Registration No." />
          </FormField>
          <FormField label="Country">
            <Select {...register('country_code')} onChange={e => { setValue('country_code', e.target.value, { shouldDirty: true }); }}>
              <option value="">Select country...</option>
              {GCC_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Industry">
            <Input {...register('industry')} placeholder="e.g. Technology, Finance" />
          </FormField>
          <FormField label="Phone">
            <Input {...register('phone')} placeholder="+973 xxxx xxxx" />
          </FormField>
          <FormField label="Email">
            <Input {...register('email')} type="email" placeholder="info@company.com" />
          </FormField>
          <FormField label="Website">
            <Input {...register('website')} placeholder="https://www.company.com" />
          </FormField>
        </div>

        <div className="border-t border-secondary-100 pt-4">
          <FormField label="Address">
            <Textarea {...register('address')} rows={2} placeholder="Full company address" />
          </FormField>
        </div>

        {/* Employee Portal Link */}
        {company?.portal_slug && (
          <PortalLinkSection slug={company.portal_slug} companyId={companyId} qc={qc} />
        )}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={save.isPending} className="btn-primary">
          <Save className="w-4 h-4" />
          {save.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
      {save.isSuccess && <p className="text-sm text-success-600 text-right">Saved successfully.</p>}
      {save.isError && <p className="text-sm text-error-600 text-right">{save.error.message}</p>}
    </form>
  );
}

function PortalLinkSection({ slug, companyId, qc }) {
  const [copied, setCopied] = useState(false);
  const [editSlug, setEditSlug] = useState(false);
  const [newSlug, setNewSlug] = useState(slug);
  const [slugErr, setSlugErr] = useState('');
  const portalUrl = `${window.location.origin}/portal/${slug}`;

  const copy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveSlug = async () => {
    const clean = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!clean) { setSlugErr('Slug cannot be empty.'); return; }
    const { error } = await supabase.from('companies').update({ portal_slug: clean }).eq('id', companyId);
    if (error) { setSlugErr(error.message); return; }
    setEditSlug(false);
    setSlugErr('');
    qc.invalidateQueries({ queryKey: ['company-profile', companyId] });
  };

  return (
    <div className="border-t border-secondary-100 pt-4">
      <p className="text-sm font-medium text-secondary-700 mb-3">Employee Self-Service Portal</p>
      <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-secondary-500 mb-1">Portal URL</p>
            {editSlug ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary-500">{window.location.origin}/portal/</span>
                <input value={newSlug} onChange={e => setNewSlug(e.target.value)}
                  className="flex-1 px-2 py-1 border border-secondary-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
            ) : (
              <p className="text-sm font-mono text-primary-700 truncate">{portalUrl}</p>
            )}
            {slugErr && <p className="text-xs text-error-600 mt-1">{slugErr}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {!editSlug ? (
            <>
              <button type="button" onClick={copy} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                {copied ? <><CheckCheck className="w-3.5 h-3.5 text-success-600" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
              </button>
              <a href={portalUrl} target="_blank" rel="noreferrer" className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> Open Portal
              </a>
              <button type="button" onClick={() => { setEditSlug(true); setNewSlug(slug); }} className="btn-secondary text-xs px-3 py-1.5">
                Edit URL
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={saveSlug} className="btn-primary text-xs px-3 py-1.5">Save</button>
              <button type="button" onClick={() => { setEditSlug(false); setSlugErr(''); }} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
            </>
          )}
        </div>
        <p className="text-xs text-secondary-500">
          Share this link with employees. They sign up using their Employee ID and work email, then log in with their password.
        </p>
      </div>
    </div>
  );
}

function SmtpConfigTab({ companyId }) {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['company-settings', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('company_settings').select('*').eq('company_id', companyId).maybeSingle();
      return data || {};
    },
    enabled: !!companyId,
  });

  const { register, handleSubmit, watch, formState: { isDirty } } = useForm({ values: settings || {} });
  const smtpEnabled = watch('smtp_enabled');

  const save = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        company_id: companyId,
        smtp_port: data.smtp_port ? parseInt(data.smtp_port) : null,
        smtp_secure: !!data.smtp_secure,
        smtp_enabled: !!data.smtp_enabled,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('company_settings').upsert(payload, { onConflict: 'company_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-settings', companyId] }),
  });

  if (isLoading) return <div className="card p-8 text-center text-secondary-400">Loading...</div>;

  return (
    <form onSubmit={handleSubmit(d => save.mutate(d))} className="space-y-4">
      <div className="card p-6 space-y-6">
        <div>
          <p className="text-sm font-semibold text-secondary-800 mb-1">Company Email (SMTP)</p>
          <p className="text-xs text-secondary-400">When enabled, all system notifications will be sent from your company's own email address.</p>
        </div>

        <div className="flex items-center gap-3 p-4 bg-secondary-50 rounded-xl">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('smtp_enabled')} className="w-4 h-4 rounded accent-primary-600" />
            <span className="text-sm font-medium text-secondary-700">Enable custom SMTP sending</span>
          </label>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${!smtpEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <FormField label="SMTP Host" required={smtpEnabled}>
            <Input {...register('smtp_host')} placeholder="smtp.gmail.com" />
          </FormField>
          <FormField label="SMTP Port">
            <Input {...register('smtp_port')} type="number" placeholder="587" />
          </FormField>
          <FormField label="SMTP Username" required={smtpEnabled}>
            <Input {...register('smtp_user')} placeholder="you@company.com" />
          </FormField>
          <FormField label="SMTP Password">
            <Input {...register('smtp_pass')} type="password" placeholder="App password or SMTP password" />
          </FormField>
          <FormField label="From Email" required={smtpEnabled}>
            <Input {...register('smtp_from_email')} type="email" placeholder="hr@company.com" />
          </FormField>
          <FormField label="From Name">
            <Input {...register('smtp_from_name')} placeholder="Company HR" />
          </FormField>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" {...register('smtp_secure')} id="smtp_secure" className="w-4 h-4 rounded accent-primary-600" />
            <label htmlFor="smtp_secure" className="text-sm text-secondary-700">Use TLS/SSL (recommended for port 465)</label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={save.isPending} className="btn-primary">
          <Save className="w-4 h-4" />
          {save.isPending ? 'Saving...' : 'Save SMTP Settings'}
        </button>
      </div>
      {save.isSuccess && <p className="text-sm text-success-600 text-right">Saved successfully.</p>}
      {save.isError && <p className="text-sm text-error-600 text-right">{save.error.message}</p>}
    </form>
  );
}

function LeaveConfigTab() {
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['leave-types-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leave_types').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  function openEdit(type) {
    setEditing(type);
    reset({
      approval_level: type.approval_level || 'any',
      min_days_notice: type.min_days_notice ?? '',
      max_carryforward: type.max_carryforward ?? '',
      require_document: type.require_document ?? false,
    });
  }

  const save = useMutation({
    mutationFn: async (data) => {
      const payload = {
        approval_level: data.approval_level,
        min_days_notice: data.min_days_notice !== '' ? parseInt(data.min_days_notice) : null,
        max_carryforward: data.max_carryforward !== '' ? parseInt(data.max_carryforward) : null,
        require_document: !!data.require_document,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('leave_types').update(payload).eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-types-all'] }); qc.invalidateQueries({ queryKey: ['leave-types'] }); setEditing(null); },
  });

  const approvalLabels = { any: 'Any', manager: 'Manager', hr: 'HR', admin: 'Admin' };

  return (
    <div className="space-y-4">
      <div className="card p-4 bg-primary-50 border border-primary-100 rounded-xl text-sm text-primary-700">
        Configure approval requirements, carryover limits, and document requirements for each leave type.
      </div>
      <div className="card">
        <Table columns={[
          { header: 'Leave Type', key: 'name', render: (v, row) => <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:row.color}}/><span className="font-medium">{v}</span><span className="text-xs text-secondary-400">({row.code})</span></div> },
          { header: 'Days/Year', key: 'days_per_year', render: v => `${v} days` },
          { header: 'Approval Level', key: 'approval_level', render: v => <Badge variant="secondary">{approvalLabels[v] || 'Any'}</Badge> },
          { header: 'Min Notice', key: 'min_days_notice', render: v => v != null ? `${v} days` : '–' },
          { header: 'Max Carryover', key: 'max_carryforward', render: v => v != null ? `${v} days` : '–' },
          { header: 'Doc Required', key: 'require_document', render: v => v ? <Badge variant="warning">Yes</Badge> : <span className="text-secondary-400 text-xs">No</span> },
          { header: '', key: 'id', render: (_, row) => <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button> },
        ]} data={types} loading={isLoading} />
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={`Configure: ${editing.name}`} size="sm"
          footer={<div className="flex justify-end gap-2"><button onClick={() => setEditing(null)} className="btn-secondary">Cancel</button><button onClick={handleSubmit(d => save.mutate(d))} disabled={save.isPending} className="btn-primary">Save</button></div>}>
          <form className="space-y-4">
            <FormField label="Approval Required From">
              <Select {...register('approval_level')}>
                <option value="any">Any (Auto-approve)</option>
                <option value="manager">Manager</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>
            <FormField label="Minimum Notice (days)" hint="How many days in advance must the request be submitted">
              <Input {...register('min_days_notice')} type="number" min="0" placeholder="0" />
            </FormField>
            <FormField label="Max Carryforward (days)" hint="Leave blank for unlimited">
              <Input {...register('max_carryforward')} type="number" min="0" placeholder="Unlimited" />
            </FormField>
            <div className="flex items-center gap-2">
              <input type="checkbox" {...register('require_document')} id="req_doc" className="w-4 h-4 rounded accent-primary-600" />
              <label htmlFor="req_doc" className="text-sm text-secondary-700">Require supporting document</label>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function DepartmentsTab({ companyId }) {
  const qc = useQueryClient();
  const { data: depts = [], isLoading } = useDepartments(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: editing || {} });

  const upsert = useMutation({
    mutationFn: async (data) => {
      if (editing) { const { error } = await supabase.from('departments').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id); if (error) throw error; }
      else { const { error } = await supabase.from('departments').insert({ ...data, company_id: companyId }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments', companyId] }); setShowForm(false); setEditing(null); },
  });

  const deleteItem = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('departments').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['departments', companyId] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); reset({}); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Department</button>
      </div>
      <div className="card">
        <Table columns={[
          { header: 'Department', key: 'name', render: (v, row) => <div><p className="font-medium">{v}</p><p className="text-xs text-secondary-400">{row.code}</p></div> },
          { header: 'Description', key: 'description' },
          { header: 'Status', key: 'is_active', render: v => <Badge variant={v ? 'active' : 'inactive'}>{v ? 'Active' : 'Inactive'}</Badge> },
          { header: 'Actions', key: 'id', render: (id, row) => (
            <div className="flex gap-1">
              <button onClick={() => { setEditing(row); reset(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )},
        ]} data={depts} loading={isLoading} />
      </div>
      {showForm && (
        <Modal isOpen onClose={() => setShowForm(false)} title={editing ? 'Edit Department' : 'Add Department'} size="sm"
          footer={<div className="flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button onClick={handleSubmit(d => upsert.mutate(d))} disabled={upsert.isPending} className="btn-primary">Save</button></div>}>
          <form className="space-y-4">
            <FormField label="Department Name" required><Input {...register('name', { required: true })} /></FormField>
            <FormField label="Code"><Input {...register('code')} placeholder="e.g. HR, FIN" /></FormField>
            <FormField label="Description"><Textarea {...register('description')} rows={2} /></FormField>
            <FormField label="Status"><Select {...register('is_active', { setValueAs: v => v === 'true' || v === true })}><option value="true">Active</option><option value="false">Inactive</option></Select></FormField>
          </form>
        </Modal>
      )}
      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={async () => { await deleteItem.mutateAsync(deletingId); setDeletingId(null); }} title="Delete Department" message="Delete this department?" />
    </div>
  );
}

function PositionsTab({ companyId }) {
  const qc = useQueryClient();
  const { data: positions = [], isLoading } = usePositions(null, companyId);
  const { data: departments = [] } = useDepartments(companyId);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: editing || {} });

  const upsert = useMutation({
    mutationFn: async (data) => {
      if (editing) { const { error } = await supabase.from('positions').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editing.id); if (error) throw error; }
      else { const { error } = await supabase.from('positions').insert({ ...data, company_id: companyId }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); setShowForm(false); setEditing(null); },
  });

  const deleteItem = useMutation({
    mutationFn: async (id) => { const { error } = await supabase.from('positions').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['positions'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); reset({}); setShowForm(true); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Position</button>
      </div>
      <div className="card">
        <Table columns={[
          { header: 'Position', key: 'title', render: (v, row) => <div><p className="font-medium">{v}</p><p className="text-xs text-secondary-400">{row.code}</p></div> },
          { header: 'Grade', key: 'grade' },
          { header: 'Status', key: 'is_active', render: v => <Badge variant={v ? 'active' : 'inactive'}>{v ? 'Active' : 'Inactive'}</Badge> },
          { header: 'Actions', key: 'id', render: (id, row) => (
            <div className="flex gap-1">
              <button onClick={() => { setEditing(row); reset(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
              <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )},
        ]} data={positions} loading={isLoading} />
      </div>
      {showForm && (
        <Modal isOpen onClose={() => setShowForm(false)} title={editing ? 'Edit Position' : 'Add Position'} size="sm"
          footer={<div className="flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button><button onClick={handleSubmit(d => upsert.mutate(d))} disabled={upsert.isPending} className="btn-primary">Save</button></div>}>
          <form className="space-y-4">
            <FormField label="Position Title" required><Input {...register('title', { required: true })} /></FormField>
            <FormField label="Code"><Input {...register('code')} /></FormField>
            <FormField label="Department"><Select {...register('department_id')}><option value="">None</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></FormField>
            <FormField label="Grade"><Input {...register('grade')} placeholder="e.g. L1, Senior, Manager" /></FormField>
          </form>
        </Modal>
      )}
      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={async () => { await deleteItem.mutateAsync(deletingId); setDeletingId(null); }} title="Delete Position" message="Delete this position?" />
    </div>
  );
}

function SalaryComponentsTab() {
  const { data: components = [], isLoading } = useQuery({
    queryKey: ['salary-components-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('salary_components').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="card">
      <Table columns={[
        { header: 'Component', key: 'name', render: (v, row) => <div><p className="font-medium">{v}</p><code className="text-xs text-secondary-400">{row.code}</code></div> },
        { header: 'Type', key: 'component_type', render: v => <Badge variant={v === 'Earning' ? 'success' : v === 'Deduction' ? 'error' : 'info'}>{v}</Badge> },
        { header: 'Calculation', key: 'calculation_type' },
        { header: 'Default Value', key: 'default_value', render: (v, row) => row.calculation_type === 'Percentage' ? `${v}%` : `BHD ${v}` },
        { header: 'GOSI', key: 'is_gosi_applicable', render: v => <Badge variant={v ? 'success' : 'default'}>{v ? 'Yes' : 'No'}</Badge> },
        { header: 'Description', key: 'description', render: v => <span className="text-xs text-secondary-400">{v}</span> },
      ]} data={components} loading={isLoading} />
    </div>
  );
}
