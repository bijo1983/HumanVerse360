import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalSupabase } from '../../lib/portalSupabase';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { formatDate, formatCurrency } from '../../lib/calculations';
import { differenceInBusinessDays, parseISO } from 'date-fns';
import {
  Calendar, FileText, CreditCard, User, Clock, CheckCircle, XCircle,
  AlertTriangle, Plus, Save, ChevronRight, Download, Edit2
} from 'lucide-react';

// ── Data hooks using portalSupabase ──────────────────────────────────────────

function usePortalEmployee(empId) {
  return useQuery({
    queryKey: ['portal-employee', empId],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('employees').select('*').eq('id', empId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!empId,
    refetchOnMount: 'always',
  });
}

function usePortalLeaveBalances(empId) {
  return useQuery({
    queryKey: ['portal-balances', empId],
    queryFn: async () => {
      const { data: balances, error } = await portalSupabase.from('leave_balances').select('*').eq('employee_id', empId);
      if (error) throw error;
      if (!balances?.length) return [];
      const ltIds = [...new Set(balances.map(b => b.leave_type_id))];
      const { data: types } = await portalSupabase.from('leave_types').select('id,name,code,color,days_per_year').in('id', ltIds);
      const ltMap = Object.fromEntries((types ?? []).map(t => [t.id, t]));
      return balances.map(b => ({ ...b, leave_types: ltMap[b.leave_type_id] ?? null }));
    },
    enabled: !!empId,
    refetchOnMount: 'always',
  });
}

function usePortalLeaveRequests(empId) {
  return useQuery({
    queryKey: ['portal-requests', empId],
    queryFn: async () => {
      const { data: reqs, error } = await portalSupabase.from('leave_requests').select('*').eq('employee_id', empId).order('created_at', { ascending: false });
      if (error) throw error;
      if (!reqs?.length) return [];
      const ltIds = [...new Set(reqs.map(r => r.leave_type_id))];
      const { data: types } = await portalSupabase.from('leave_types').select('id,name,code,color').in('id', ltIds);
      const ltMap = Object.fromEntries((types ?? []).map(t => [t.id, t]));
      return reqs.map(r => ({ ...r, leave_types: ltMap[r.leave_type_id] ?? null }));
    },
    enabled: !!empId,
    refetchOnMount: 'always',
  });
}

function usePortalLeaveTypes() {
  return useQuery({
    queryKey: ['portal-leave-types'],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('leave_types').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data ?? [];
    },
  });
}

function usePortalDocuments(empId) {
  return useQuery({
    queryKey: ['portal-docs', empId],
    queryFn: async () => {
      const { data, error } = await portalSupabase.from('employee_documents').select('*').eq('employee_id', empId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empId,
  });
}

function usePortalPayslips(empId) {
  return useQuery({
    queryKey: ['portal-payslips', empId],
    queryFn: async () => {
      const { data: items, error } = await portalSupabase.from('payroll_line_items').select('*').eq('employee_id', empId).order('created_at', { ascending: false });
      if (error) throw error;
      if (!items?.length) return [];
      const runIds = [...new Set(items.map(i => i.payroll_run_id))];
      const { data: runs } = await portalSupabase.from('payroll_runs').select('id,month,year,status').in('id', runIds);
      const runMap = Object.fromEntries((runs ?? []).map(r => [r.id, r]));
      return items.map(i => ({ ...i, payroll_run: runMap[i.payroll_run_id] ?? null }));
    },
    enabled: !!empId,
  });
}

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  Pending:  'bg-warning-50 text-warning-700 border-warning-200',
  Approved: 'bg-success-50 text-success-700 border-success-200',
  Rejected: 'bg-error-50 text-error-700 border-error-200',
  Cancelled:'bg-secondary-50 text-secondary-500 border-secondary-200',
};
function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? STATUS_STYLES.Pending}`}>
      {status}
    </span>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ empId, onTabChange }) {
  const { data: balances = [] } = usePortalLeaveBalances(empId);
  const { data: requests = [] } = usePortalLeaveRequests(empId);
  const { data: payslips = [] } = usePortalPayslips(empId);
  const { employee } = usePortalAuth();
  const pending   = requests.filter(r => r.status === 'Pending').length;
  const recent    = requests.slice(0, 3);
  const recentPay = payslips.slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h2 className="text-xl font-bold">Welcome back, {employee?.first_name}!</h2>
        <p className="text-primary-100 text-sm mt-1">
          {employee?.employee_id} &bull; Joined {formatDate(employee?.joining_date)}
        </p>
        <div className="flex gap-6 mt-4">
          <div>
            <p className="text-primary-200 text-xs">Pending Leaves</p>
            <p className="text-2xl font-bold">{pending}</p>
          </div>
          <div>
            <p className="text-primary-200 text-xs">Leave Types</p>
            <p className="text-2xl font-bold">{balances.length}</p>
          </div>
        </div>
      </div>

      {/* Leave balances summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-secondary-700">Leave Balances</h3>
          <button onClick={() => onTabChange('leave')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {balances.slice(0, 4).map(b => {
            const remaining = parseFloat(b.entitled_days) - parseFloat(b.used_days) - parseFloat(b.pending_days);
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: b.leave_types?.color ?? '#6b7280' }} />
                  <span className="text-xs font-medium text-secondary-600 truncate">{b.leave_types?.name}</span>
                </div>
                <p className="text-2xl font-bold text-secondary-900">{remaining.toFixed(0)}</p>
                <p className="text-xs text-secondary-400 mt-0.5">of {b.entitled_days} days remaining</p>
                {parseFloat(b.pending_days) > 0 && (
                  <p className="text-xs text-warning-600 mt-1">{b.pending_days} pending</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent requests */}
      {recent.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-secondary-700">Recent Leave Requests</h3>
            <button onClick={() => onTabChange('leave')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="card divide-y divide-secondary-100">
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.leave_types?.color ?? '#6b7280' }} />
                  <div>
                    <p className="text-sm font-medium text-secondary-800">{r.leave_types?.name ?? 'Leave'}</p>
                    <p className="text-xs text-secondary-400">{formatDate(r.start_date)} – {formatDate(r.end_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-secondary-500">{r.days_requested}d</span>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent payslips */}
      {recentPay.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-secondary-700">Recent Payslips</h3>
            <button onClick={() => onTabChange('payslips')} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="card divide-y divide-secondary-100">
            {recentPay.map(p => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-secondary-800">
                    {MONTHS[(p.payroll_run?.month ?? 1) - 1]} {p.payroll_run?.year}
                  </p>
                  <p className="text-xs text-secondary-400">{p.payroll_run?.status}</p>
                </div>
                <p className="text-sm font-semibold text-secondary-900">{formatCurrency(p.net_salary)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────
function ProfileTab({ empId }) {
  const qc = useQueryClient();
  const { data: emp, isLoading } = usePortalEmployee(empId);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({});
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  const startEdit = () => {
    setForm({
      personal_email:       emp?.personal_email ?? '',
      phone:                emp?.phone ?? '',
      mobile:               emp?.mobile ?? '',
      address:              emp?.address ?? '',
      date_of_birth:        emp?.date_of_birth ?? '',
      nationality:          emp?.nationality ?? '',
      gender:               emp?.gender ?? '',
      marital_status:       emp?.marital_status ?? '',
      religion:             emp?.religion ?? '',
      arabic_name:          emp?.arabic_name ?? '',
      passport_number:      emp?.passport_number ?? '',
      passport_expiry:      emp?.passport_expiry ?? '',
      passport_issue_country: emp?.passport_issue_country ?? '',
      cpr_number:           emp?.cpr_number ?? '',
      cpr_expiry:           emp?.cpr_expiry ?? '',
      visa_number:          emp?.visa_number ?? '',
      visa_expiry:          emp?.visa_expiry ?? '',
    });
    setEditing(true);
    setMsg('');
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    const { error } = await portalSupabase.from('employees').update({ ...form, updated_at: new Date().toISOString() }).eq('id', empId);
    if (error) { setMsg('Error: ' + error.message); }
    else {
      setMsg('Profile updated successfully.');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['portal-employee', empId] });
    }
    setSaving(false);
  };

  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;

  const Row = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-3 border-b border-secondary-100 last:border-0">
      <span className="text-xs font-medium text-secondary-500 sm:w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-secondary-800">{value || <span className="text-secondary-300">—</span>}</span>
    </div>
  );

  const Field = ({ label, field, type = 'text', options }) => (
    <div>
      <label className="block text-xs font-medium text-secondary-500 mb-1">{label}</label>
      {options ? (
        <select value={form[field] ?? ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Select...</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={form[field] ?? ''} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
          className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm rounded-lg p-3 border ${msg.startsWith('Error') ? 'bg-error-50 border-error-200 text-error-700' : 'bg-success-50 border-success-200 text-success-700'}`}>
          {msg}
        </div>
      )}

      {/* Employment (read-only) */}
      <div className="card p-6">
        <h3 className="section-title mb-4">Employment Information</h3>
        <Row label="Employee ID"     value={emp?.employee_id} />
        <Row label="Full Name"       value={`${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`} />
        <Row label="Work Email"      value={emp?.work_email} />
        <Row label="Job Title"       value={emp?.position_id ? '–' : '–'} />
        <Row label="Joining Date"    value={formatDate(emp?.joining_date)} />
        <Row label="Employment Type" value={emp?.employment_type} />
        <Row label="Status"          value={emp?.status} />
      </div>

      {/* Personal (editable) */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Personal Information</h3>
          {!editing && (
            <button onClick={startEdit} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-1.5">
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          )}
        </div>

        {!editing ? (
          <>
            <Row label="Arabic Name"    value={emp?.arabic_name} />
            <Row label="Personal Email" value={emp?.personal_email} />
            <Row label="Phone"          value={emp?.phone} />
            <Row label="Mobile"         value={emp?.mobile} />
            <Row label="Address"        value={emp?.address} />
            <Row label="Date of Birth"  value={formatDate(emp?.date_of_birth)} />
            <Row label="Nationality"    value={emp?.nationality} />
            <Row label="Gender"         value={emp?.gender} />
            <Row label="Marital Status" value={emp?.marital_status} />
            <Row label="Religion"       value={emp?.religion} />
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Arabic Name"    field="arabic_name" />
            <Field label="Personal Email" field="personal_email" type="email" />
            <Field label="Phone"          field="phone" type="tel" />
            <Field label="Mobile"         field="mobile" type="tel" />
            <div className="sm:col-span-2"><Field label="Address" field="address" /></div>
            <Field label="Date of Birth"  field="date_of_birth" type="date" />
            <Field label="Nationality"    field="nationality" />
            <Field label="Gender"         field="gender" options={['Male','Female']} />
            <Field label="Marital Status" field="marital_status" options={['Single','Married','Divorced','Widowed']} />
            <Field label="Religion"       field="religion" />
          </div>
        )}
      </div>

      {/* Identity documents (editable) */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Identity Documents</h3>
        </div>
        {!editing ? (
          <>
            <Row label="National ID"            value={emp?.cpr_number} />
            <Row label="National ID Expiry"     value={formatDate(emp?.cpr_expiry)} />
            <Row label="Passport No."        value={emp?.passport_number} />
            <Row label="Passport Expiry"     value={formatDate(emp?.passport_expiry)} />
            <Row label="Passport Issued In"  value={emp?.passport_issue_country} />
            <Row label="Visa Number"         value={emp?.visa_number} />
            <Row label="Visa Expiry"         value={formatDate(emp?.visa_expiry)} />
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="National ID"          field="cpr_number" />
            <Field label="National ID Expiry"   field="cpr_expiry" type="date" />
            <Field label="Passport No."       field="passport_number" />
            <Field label="Passport Expiry"    field="passport_expiry" type="date" />
            <Field label="Passport Issued In" field="passport_issue_country" />
            <Field label="Visa Number"        field="visa_number" />
            <Field label="Visa Expiry"        field="visa_expiry" type="date" />
          </div>
        )}
      </div>

      {editing && (
        <div className="flex gap-3 justify-end">
          <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
}

// ── Leave tab ────────────────────────────────────────────────────────────────
function LeaveTab({ empId, companyId }) {
  const qc = useQueryClient();
  const { data: balances = [] } = usePortalLeaveBalances(empId);
  const { data: requests = [] } = usePortalLeaveRequests(empId);
  const { data: types    = [] } = usePortalLeaveTypes();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]           = useState('');

  const days = form.start_date && form.end_date
    ? Math.max(1, differenceInBusinessDays(parseISO(form.end_date), parseISO(form.start_date)) + 1)
    : 0;

  const submitLeave = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      setMsg('Please fill all required fields.'); return;
    }
    setSubmitting(true); setMsg('');
    const year = parseInt(form.start_date.slice(0, 4));
    const { error } = await portalSupabase.from('leave_requests').insert({
      employee_id: empId,
      company_id:  companyId,
      leave_type_id: form.leave_type_id,
      start_date: form.start_date,
      end_date:   form.end_date,
      days_requested: days,
      year,
      reason: form.reason,
      status: 'Pending',
    });
    if (error) { setMsg('Error: ' + error.message); }
    else {
      setMsg('Leave request submitted successfully.');
      setShowForm(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      qc.invalidateQueries({ queryKey: ['portal-requests', empId] });
      qc.invalidateQueries({ queryKey: ['portal-balances', empId] });
    }
    setSubmitting(false);
  };

  const cancelRequest = async (id) => {
    await portalSupabase.from('leave_requests').update({ status: 'Cancelled' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['portal-requests', empId] });
    qc.invalidateQueries({ queryKey: ['portal-balances', empId] });
  };

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`text-sm rounded-lg p-3 border ${msg.startsWith('Error') ? 'bg-error-50 border-error-200 text-error-700' : 'bg-success-50 border-success-200 text-success-700'}`}>
          {msg}
        </div>
      )}

      {/* Balances */}
      <div>
        <h3 className="text-sm font-semibold text-secondary-700 mb-3">Leave Balances ({new Date().getFullYear()})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map(b => {
            const remaining = Math.max(0, parseFloat(b.entitled_days) - parseFloat(b.used_days) - parseFloat(b.pending_days));
            const pct = parseFloat(b.entitled_days) > 0 ? (parseFloat(b.used_days) / parseFloat(b.entitled_days)) * 100 : 0;
            return (
              <div key={b.id} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: b.leave_types?.color ?? '#6b7280' }} />
                  <span className="text-sm font-semibold text-secondary-800">{b.leave_types?.name}</span>
                </div>
                <div className="flex justify-between text-xs text-secondary-500 mb-1">
                  <span>Used: {b.used_days}d</span>
                  <span>Entitled: {b.entitled_days}d</span>
                </div>
                <div className="w-full h-1.5 bg-secondary-100 rounded-full mb-2">
                  <div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className="text-lg font-bold text-secondary-900">{remaining.toFixed(0)} <span className="text-xs font-normal text-secondary-400">days left</span></p>
                {parseFloat(b.pending_days) > 0 && (
                  <p className="text-xs text-warning-600 mt-1">{b.pending_days}d pending approval</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Submit leave */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title">Leave Requests</h3>
          <button onClick={() => setShowForm(v => !v)} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-1.5">
            <Plus className="w-3.5 h-3.5" /> New Request
          </button>
        </div>

        {showForm && (
          <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 mb-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-secondary-500 mb-1">Leave Type *</label>
                <select value={form.leave_type_id} onChange={e => setForm(f => ({ ...f, leave_type_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <option value="">Select leave type...</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-500 mb-1">Start Date *</label>
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary-500 mb-1">End Date *</label>
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  min={form.start_date}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-secondary-500 mb-1">Reason</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
              </div>
            </div>
            {days > 0 && <p className="text-xs text-primary-700 font-medium">Duration: {days} working day{days !== 1 ? 's' : ''}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="btn-secondary text-sm px-3 py-1.5">Cancel</button>
              <button onClick={submitLeave} disabled={submitting} className="btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5">
                {submitting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                Submit
              </button>
            </div>
          </div>
        )}

        {/* Request history */}
        {requests.length === 0 ? (
          <p className="text-sm text-secondary-400 text-center py-6">No leave requests yet.</p>
        ) : (
          <div className="divide-y divide-secondary-100">
            {requests.map(r => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.leave_types?.color ?? '#6b7280' }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-secondary-800">{r.leave_types?.name ?? 'Leave'}</p>
                    <p className="text-xs text-secondary-400">{formatDate(r.start_date)} – {formatDate(r.end_date)} &bull; {r.days_requested}d</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={r.status} />
                  {r.status === 'Pending' && (
                    <button onClick={() => cancelRequest(r.id)} className="text-xs text-error-600 hover:text-error-700 font-medium">Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────
function DocumentsTab({ empId }) {
  const { data: docs = [], isLoading } = usePortalDocuments(empId);
  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!docs.length) return <div className="card p-12 text-center text-secondary-400 text-sm">No documents on file.</div>;
  return (
    <div className="card divide-y divide-secondary-100">
      {docs.map(d => (
        <div key={d.id} className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-secondary-800">{d.document_name}</p>
              <p className="text-xs text-secondary-400">{d.document_type} &bull; Added {formatDate(d.created_at?.split('T')[0])}</p>
            </div>
          </div>
          {d.file_url && (
            <a href={d.file_url} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-1.5 text-xs px-2.5 py-1.5">
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Payslips tab ──────────────────────────────────────────────────────────────
function PayslipsTab({ empId }) {
  const { employee } = usePortalAuth();
  const { data: payslips = [], isLoading } = usePortalPayslips(empId);
  const [expanded, setExpanded] = useState(null);
  if (isLoading) return <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!payslips.length) return <div className="card p-12 text-center text-secondary-400 text-sm">No payslips available yet.</div>;
  return (
    <div className="space-y-3">
      {payslips.map(p => (
        <div key={p.id} className="card overflow-hidden">
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary-50 transition-colors"
            onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
            <div>
              <p className="text-sm font-semibold text-secondary-800">
                {MONTHS[(p.payroll_run?.month ?? 1) - 1]} {p.payroll_run?.year}
              </p>
              <p className="text-xs text-secondary-400">{p.payroll_run?.status}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-secondary-900">{formatCurrency(p.net_salary)} <span className="text-xs font-normal text-secondary-400">net</span></p>
              <p className="text-xs text-secondary-400">{formatCurrency(p.gross_salary)} gross</p>
            </div>
          </div>
          {expanded === p.id && (
            <div className="border-t border-secondary-100 p-4 bg-secondary-50 text-sm">
              <div className="grid grid-cols-2 gap-y-2">
                {[
                  ['Basic Salary', p.basic_salary],
                  ['Housing Allowance', p.housing_allowance],
                  ['Transport Allowance', p.transport_allowance],
                  ['Food Allowance', p.food_allowance],
                  ['Other Allowances', p.other_allowances],
                  ['Overtime', p.overtime_amount],
                  ['Bonus', p.bonus],
                ].filter(([,v]) => parseFloat(v ?? 0) > 0).map(([label, val]) => (
                  <div key={label} className="flex justify-between col-span-2 sm:col-span-1">
                    <span className="text-secondary-500">{label}</span>
                    <span className="font-medium">{formatCurrency(val)}</span>
                  </div>
                ))}
                <div className="col-span-2 border-t border-secondary-200 pt-2 mt-1">
                  <div className="flex justify-between font-semibold">
                    <span>Gross Salary</span><span>{formatCurrency(p.gross_salary)}</span>
                  </div>
                  <div className="flex justify-between text-error-600">
                    <span>GOSI (Employee)</span><span>- {formatCurrency(p.gosi_employee)}</span>
                  </div>
                  {parseFloat(p.other_deductions ?? 0) > 0 && (
                    <div className="flex justify-between text-error-600">
                      <span>Other Deductions</span><span>- {formatCurrency(p.other_deductions)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-primary-700 mt-1 pt-1 border-t border-secondary-200">
                    <span>Net Salary</span><span>{formatCurrency(p.net_salary)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',  label: 'Dashboard',  icon: '🏠' },
  { key: 'profile',   label: 'My Profile', icon: '👤' },
  { key: 'leave',     label: 'Leave',      icon: '📅' },
  { key: 'documents', label: 'Documents',  icon: '📄' },
  { key: 'payslips',  label: 'Payslips',   icon: '💳' },
];

export default function PortalDashboard() {
  const { employee } = usePortalAuth();
  const [tab, setTab] = useState('overview');

  // Support navigation from sidebar via custom events
  useEffect(() => {
    const handler = (e) => setTab(e.detail);
    window.addEventListener('portal-nav', handler);
    return () => window.removeEventListener('portal-nav', handler);
  }, []);

  if (!employee) return null;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-secondary-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5
              ${tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview'  && <OverviewTab  empId={employee.id} onTabChange={setTab} />}
      {tab === 'profile'   && <ProfileTab   empId={employee.id} />}
      {tab === 'leave'     && <LeaveTab     empId={employee.id} companyId={employee.company_id} />}
      {tab === 'documents' && <DocumentsTab empId={employee.id} />}
      {tab === 'payslips'  && <PayslipsTab  empId={employee.id} />}
    </div>
  );
}
