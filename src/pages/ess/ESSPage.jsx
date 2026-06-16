import { useState } from 'react';
import { useEmployees } from '../../hooks/useEmployees';
import { useLeaveBalances, useLeaveRequests, useCreateLeaveRequest, useLeaveTypes } from '../../hooks/useLeave';
import { useDocuments } from '../../hooks/useDocuments';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { FormField, Select, Input, Textarea } from '../../components/ui/Form';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency, getDaysUntilExpiry, getDocumentStatus } from '../../lib/calculations';
import { useForm } from 'react-hook-form';
import { differenceInBusinessDays, parseISO } from 'date-fns';
import {
  User, Calendar, FileText, DollarSign, Home, Bell, LogOut,
  ChevronRight, Clock, CheckCircle, AlertTriangle, Plus
} from 'lucide-react';

export default function ESSPage() {
  const { companyId } = useAuth();
  const [selectedEmp, setSelectedEmp] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);

  const emp = employees.find(e => e.id === selectedEmp);

  if (!selectedEmp) {
    return <ESSLogin employees={employees} onSelect={setSelectedEmp} />;
  }

  const tabs = [
    { key: 'home', icon: Home, label: 'Home' },
    { key: 'leave', icon: Calendar, label: 'Leave' },
    { key: 'payslips', icon: DollarSign, label: 'Pay' },
    { key: 'documents', icon: FileText, label: 'Docs' },
    { key: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="max-w-sm mx-auto min-h-[calc(100vh-80px)] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-secondary-200">
      {/* ESS Header */}
      <div className="bg-gradient-to-br from-primary-900 to-primary-700 text-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-primary-200">Employee Self Service</p>
            <p className="font-bold text-lg">{emp?.first_name} {emp?.last_name}</p>
            <p className="text-xs text-primary-200">{emp?.employee_id} · {emp?.department_name}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
            <span className="font-bold text-white text-lg">{emp?.first_name?.[0]}{emp?.last_name?.[0]}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'home' && <ESSHome emp={emp} companyId={companyId} onLeaveApply={() => setShowLeaveForm(true)} />}
        {activeTab === 'leave' && <ESSLeave emp={emp} companyId={companyId} onApply={() => setShowLeaveForm(true)} />}
        {activeTab === 'payslips' && <ESSPayslips emp={emp} />}
        {activeTab === 'documents' && <ESSDocuments emp={emp} companyId={companyId} />}
        {activeTab === 'profile' && <ESSProfile emp={emp} />}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-secondary-200 bg-white">
        <div className="flex">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs font-medium transition-colors ${activeTab === t.key ? 'text-primary-600' : 'text-secondary-400 hover:text-secondary-600'}`}>
              <t.icon className={`w-5 h-5 ${activeTab === t.key ? 'text-primary-600' : ''}`} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => setSelectedEmp('')} className="absolute top-20 right-8 text-xs text-secondary-400 hover:text-secondary-600">
        Switch User
      </button>

      {showLeaveForm && <ESSLeaveForm empId={selectedEmp} companyId={companyId} onClose={() => setShowLeaveForm(false)} />}
    </div>
  );
}

function ESSLogin({ employees, onSelect }) {
  const [empId, setEmpId] = useState('');
  return (
    <div className="max-w-sm mx-auto">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-xl font-bold text-secondary-900 mb-1">Employee Self Service</h2>
        <p className="text-sm text-secondary-500 mb-6">Select your profile to continue</p>
        <FormField label="Select Employee">
          <Select value={empId} onChange={e => setEmpId(e.target.value)}>
            <option value="">Choose your name...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}
          </Select>
        </FormField>
        <button onClick={() => empId && onSelect(empId)} disabled={!empId} className="btn-primary w-full justify-center mt-4">
          Access Self Service
        </button>
        <p className="text-xs text-secondary-400 mt-4">This is a demo ESS portal. In production, employees would authenticate with their credentials.</p>
      </div>
    </div>
  );
}

function ESSHome({ emp, companyId, onLeaveApply }) {
  const year = new Date().getFullYear();
  const { data: balances = [] } = useLeaveBalances(emp?.id, year, companyId);
  const { data: docs = [] } = useDocuments({ employee_id: emp?.id }, companyId);

  const annualBalance = balances.find(b => b.leave_types?.code === 'AL');
  const expiringDocs = docs.filter(d => {
    const s = getDocumentStatus(d.expiry_date);
    return s === 'expired' || s === 'critical' || s === 'warning';
  });

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onLeaveApply} className="p-4 bg-primary-50 rounded-xl text-left border border-primary-100 hover:bg-primary-100 transition-colors">
          <Calendar className="w-6 h-6 text-primary-600 mb-2" />
          <p className="text-sm font-semibold text-primary-800">Apply Leave</p>
          <p className="text-xs text-primary-500">Request time off</p>
        </button>
        <div className="p-4 bg-accent-50 rounded-xl border border-accent-100">
          <DollarSign className="w-6 h-6 text-accent-600 mb-2" />
          <p className="text-sm font-semibold text-accent-800">My Salary</p>
          <p className="text-xs text-accent-600 font-mono">{formatCurrency(emp?.basic_salary)}</p>
        </div>
      </div>

      {/* Annual Leave Balance */}
      {annualBalance && (
        <div className="p-4 bg-secondary-50 rounded-xl border border-secondary-200">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-semibold text-secondary-700">Annual Leave Balance</p>
            <span className="text-xs text-secondary-400">{year}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-primary-600">
              {annualBalance.entitled_days - annualBalance.used_days - annualBalance.pending_days}
            </span>
            <span className="text-sm text-secondary-400">/ {annualBalance.entitled_days} days</span>
          </div>
          <div className="mt-2 h-2 bg-secondary-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full" style={{
              width: `${Math.min(100, ((annualBalance.used_days + annualBalance.pending_days) / annualBalance.entitled_days) * 100)}%`
            }} />
          </div>
        </div>
      )}

      {/* Document Alerts */}
      {expiringDocs.length > 0 && (
        <div className="p-4 bg-warning-50 rounded-xl border border-warning-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning-600" />
            <p className="text-sm font-semibold text-warning-700">{expiringDocs.length} Document Alert{expiringDocs.length > 1 ? 's' : ''}</p>
          </div>
          {expiringDocs.map(d => (
            <p key={d.id} className="text-xs text-warning-600">· {d.document_type} expires {formatDate(d.expiry_date)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ESSLeave({ emp, companyId, onApply }) {
  const year = new Date().getFullYear();
  const { data: balances = [] } = useLeaveBalances(emp?.id, year, companyId);
  const { data: requests = [] } = useLeaveRequests({ employee_id: emp?.id, year }, companyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-secondary-700">Leave Balances {year}</p>
        <button onClick={onApply} className="btn-primary py-1.5 text-xs"><Plus className="w-3 h-3" /> Apply</button>
      </div>
      <div className="space-y-2">
        {balances.map(b => {
          const balance = b.entitled_days + b.carried_forward - b.used_days - b.pending_days;
          return (
            <div key={b.id} className="p-3 bg-secondary-50 rounded-xl border border-secondary-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: b.leave_types?.color }} />
                <p className="text-sm font-medium text-secondary-700">{b.leave_types?.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-secondary-900">{balance}d</p>
                <p className="text-xs text-secondary-400">of {b.entitled_days}d</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs font-semibold text-secondary-500 uppercase mt-4">Recent Requests</p>
      <div className="space-y-2">
        {requests.slice(0, 5).map(r => (
          <div key={r.id} className="p-3 border border-secondary-100 rounded-xl">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-secondary-800">{r.leave_types?.name}</p>
                <p className="text-xs text-secondary-400">{formatDate(r.start_date)} – {formatDate(r.end_date)} ({r.days_requested}d)</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
          </div>
        ))}
        {requests.length === 0 && <p className="text-sm text-secondary-400 text-center py-4">No leave requests</p>}
      </div>
    </div>
  );
}

function ESSPayslips({ emp }) {
  const { data: payslips = [] } = useQuery({
    queryKey: ['ess-payslips', emp?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_line_items')
        .select('*, payroll_runs(month, year, status)')
        .eq('employee_id', emp?.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return data;
    },
    enabled: !!emp?.id,
  });

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-secondary-700">My Payslips</p>
      {payslips.length === 0 ? (
        <div className="text-center py-8 text-secondary-400 text-sm">No payslips available yet</div>
      ) : payslips.map(p => (
        <div key={p.id} className="p-4 border border-secondary-100 rounded-xl">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-secondary-800">{MONTHS[(p.payroll_runs?.month || 1) - 1]} {p.payroll_runs?.year}</p>
              <StatusBadge status={p.payroll_runs?.status || 'Draft'} />
            </div>
            <div className="text-right">
              <p className="text-xs text-secondary-400">Net Pay</p>
              <p className="text-base font-bold text-success-700 font-mono">{formatCurrency(p.net_salary)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-secondary-100">
            {[['Gross', p.gross_salary], ['Deductions', p.total_deductions], ['Net', p.net_salary]].map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-secondary-400">{k}</p>
                <p className="text-xs font-semibold font-mono text-secondary-700">{formatCurrency(v)}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ESSDocuments({ emp, companyId }) {
  const { data: docs = [] } = useDocuments({ employee_id: emp?.id }, companyId);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-secondary-700">My Documents</p>
      {docs.length === 0 ? (
        <div className="text-center py-8 text-secondary-400 text-sm">No documents on file</div>
      ) : docs.map(d => {
        const days = getDaysUntilExpiry(d.expiry_date);
        const status = getDocumentStatus(d.expiry_date);
        return (
          <div key={d.id} className="p-3 border border-secondary-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-secondary-800">{d.document_type}</p>
              {d.document_number && <p className="text-xs text-secondary-400">{d.document_number}</p>}
              {d.expiry_date && <p className="text-xs text-secondary-400">Expires: {formatDate(d.expiry_date)}</p>}
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              status === 'expired' ? 'bg-error-100 text-error-700' :
              status === 'critical' ? 'bg-red-100 text-red-700' :
              status === 'warning' ? 'bg-warning-100 text-warning-700' :
              'bg-success-100 text-success-700'
            }`}>
              {days === null ? 'Valid' : days < 0 ? 'Expired' : `${days}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ESSProfile({ emp }) {
  const gross = (emp?.basic_salary || 0) + (emp?.housing_allowance || 0) + (emp?.transport_allowance || 0) + (emp?.food_allowance || 0) + (emp?.other_allowances || 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-4">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-2">
          <span className="text-xl font-bold text-primary-700">{emp?.first_name?.[0]}{emp?.last_name?.[0]}</span>
        </div>
        <p className="font-bold text-secondary-900">{emp?.first_name} {emp?.last_name}</p>
        <p className="text-sm text-secondary-500">{emp?.position_title || '–'}</p>
        <StatusBadge status={emp?.status} />
      </div>

      <div className="space-y-2">
        {[
          ['Employee ID', emp?.employee_id],
          ['Department', emp?.department_name],
          ['Email', emp?.work_email],
          ['Mobile', emp?.mobile],
          ['Joining Date', formatDate(emp?.joining_date)],
          ['Employment Type', emp?.employment_type],
          ['Basic Salary', formatCurrency(emp?.basic_salary)],
          ['Gross Salary', formatCurrency(gross)],
        ].map(([k, v]) => v ? (
          <div key={k} className="flex justify-between py-2 border-b border-secondary-100 text-sm">
            <span className="text-secondary-400">{k}</span>
            <span className="font-medium text-secondary-700 text-right max-w-48 truncate">{v}</span>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

function ESSLeaveForm({ empId, companyId, onClose }) {
  const { data: leaveTypes = [] } = useLeaveTypes();
  const createLeave = useCreateLeaveRequest(companyId);
  const { register, handleSubmit, watch } = useForm({ defaultValues: { employee_id: empId } });
  const startDate = watch('start_date');
  const endDate = watch('end_date');
  const days = startDate && endDate ? Math.max(1, differenceInBusinessDays(parseISO(endDate), parseISO(startDate)) + 1) : 0;

  return (
    <Modal isOpen onClose={onClose} title="Apply for Leave" size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(async d => { try { await createLeave.mutateAsync({ ...d, days_requested: days, year: new Date(d.start_date).getFullYear() }); onClose(); } catch(e) { alert(e.message); } })} disabled={createLeave.isPending} className="btn-primary">
            {createLeave.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      }>
      <form className="space-y-4">
        <FormField label="Leave Type" required><Select {...register('leave_type_id', { required: true })}><option value="">Select...</option>{leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="From" required><Input {...register('start_date', { required: true })} type="date" /></FormField>
          <FormField label="To" required><Input {...register('end_date', { required: true })} type="date" /></FormField>
        </div>
        {days > 0 && <div className="text-xs text-primary-600 font-medium">{days} working days</div>}
        <FormField label="Reason"><Textarea {...register('reason')} rows={2} placeholder="Reason..." /></FormField>
      </form>
    </Modal>
  );
}
