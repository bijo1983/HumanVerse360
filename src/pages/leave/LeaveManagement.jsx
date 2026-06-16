import { useState, useRef } from 'react';
import { Plus, CheckCircle, XCircle, Upload, FileSpreadsheet, Clock, User, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePendingLeaveRequests, useLeaveRequests, useLeaveTypes, useUpdateLeaveRequest, useCreateLeaveRequest, useLeaveBalances, useInitLeaveBalances } from '../../hooks/useLeave';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { Table } from '../../components/ui/Table';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { formatDate } from '../../lib/calculations';
import { useForm } from 'react-hook-form';
import { differenceInBusinessDays, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { downloadLeaveBalanceTemplate, parseLeaveBalanceImport } from '../../lib/excelUtils';

export default function LeaveManagement() {
  const { companyId, userRole } = useAuth();
  const [tab, setTab] = useState('approvals');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pendingRequests = [], isLoading: pendingLoading, error: pendingError } = usePendingLeaveRequests(companyId);
  const { data: allRequests = [], isLoading: allLoading } = useLeaveRequests(
    { status: statusFilter || undefined, year: yearFilter ? parseInt(yearFilter) : undefined },
    companyId
  );

  const updateLeave = useUpdateLeaveRequest();

  const handleApprove = async (id) => {
    await updateLeave.mutateAsync({ id, status: 'Approved', approved_by: null, approved_at: new Date().toISOString() });
  };
  const handleReject = async () => {
    await updateLeave.mutateAsync({ id: rejectingId, status: 'Rejected', rejection_reason: rejectReason });
    setRejectingId(null);
    setRejectReason('');
  };

  const canApprove = (leaveType) => {
    if (!leaveType) return true;
    const level = leaveType.approval_level;
    if (!level || level === 'any') return true;
    if (level === 'admin') return userRole === 'admin';
    if (level === 'hr') return userRole === 'admin' || userRole === 'hr';
    if (level === 'manager') return userRole === 'admin' || userRole === 'hr' || userRole === 'manager';
    return true;
  };

  const allColumns = [
    { header: 'Employee', key: 'employees', render: (v) => v ? <div><p className="text-sm font-medium text-secondary-800">{v.first_name} {v.last_name}</p><p className="text-xs text-secondary-400">{v.employee_id}</p></div> : '–' },
    { header: 'Leave Type', key: 'leave_types', render: (v) => v ? <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:v.color}}/><span className="text-sm">{v.name}</span>{!v.is_paid && <Badge variant="warning" size="xs">Unpaid</Badge>}</div> : '–' },
    { header: 'From', key: 'start_date', render: (v) => formatDate(v) },
    { header: 'To', key: 'end_date', render: (v) => formatDate(v) },
    { header: 'Days', key: 'days_requested', render: (v) => <span className="font-semibold">{v}</span> },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Actions', key: 'id', render: (id, row) => row.status === 'Pending' && canApprove(row.leave_types) ? (
      <div className="flex gap-1">
        <button onClick={() => handleApprove(id)} className="p-1.5 bg-success-50 text-success-600 rounded-lg hover:bg-success-100" title="Approve"><CheckCircle className="w-3.5 h-3.5" /></button>
        <button onClick={() => setRejectingId(id)} className="p-1.5 bg-error-50 text-error-600 rounded-lg hover:bg-error-100" title="Reject"><XCircle className="w-3.5 h-3.5" /></button>
      </div>
    ) : null },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const tabList = [
    { key: 'approvals', label: 'Pending Approvals', badge: pendingRequests.length > 0 ? pendingRequests.length : null },
    { key: 'requests', label: 'All Requests' },
    { key: 'balances', label: 'Leave Balances' },
    { key: 'types', label: 'Leave Types' },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div><h2 className="text-xl font-bold text-secondary-900">Leave Management</h2><p className="text-sm text-secondary-500">Bahrain Labor Law compliant</p></div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm"><Upload className="w-3.5 h-3.5" /> Import Balances</button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Request</button>
        </div>
      </div>
      <div className="flex gap-1 border-b border-secondary-200">
        {tabList.map(({ key, label, badge }) => (
          <button key={key} onClick={() => setTab(key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {label}
            {badge != null && <span className="bg-warning-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">{badge}</span>}
          </button>
        ))}
      </div>

      {tab === 'approvals' && (
        <PendingApprovalsTab
          requests={pendingRequests}
          loading={pendingLoading}
          error={pendingError}
          canApprove={canApprove}
          onApprove={handleApprove}
          onReject={(id) => setRejectingId(id)}
          userRole={userRole}
        />
      )}

      {tab === 'requests' && (
        <>
          <div className="card p-4 flex flex-wrap gap-3">
            <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
              <option value="">All Statuses</option>
              {['Pending', 'Approved', 'Rejected', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
            </Select>
            <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-32">
              <option value="">All Years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>
          <div className="card"><Table columns={allColumns} data={allRequests} loading={allLoading} emptyMessage="No leave requests found." /></div>
        </>
      )}

      {tab === 'balances' && <LeaveBalancesTab companyId={companyId} />}
      {tab === 'types' && <LeaveTypesTab />}
      {showForm && <LeaveRequestForm companyId={companyId} onClose={() => setShowForm(false)} />}
      {showImport && <LeaveBalanceImportModal companyId={companyId} onClose={() => setShowImport(false)} />}
      <Modal isOpen={!!rejectingId} onClose={() => setRejectingId(null)} title="Reject Leave Request" size="sm"
        footer={<div className="flex justify-end gap-2"><button onClick={() => setRejectingId(null)} className="btn-secondary">Cancel</button><button onClick={handleReject} className="btn-danger">Reject</button></div>}>
        <FormField label="Rejection Reason" required><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} /></FormField>
      </Modal>
    </div>
  );
}

function PendingApprovalsTab({ requests, loading, error, canApprove, onApprove, onReject, userRole }) {
  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 flex items-center gap-3 text-error-700 bg-error-50 border border-error-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Failed to load pending requests</p>
          <p className="text-sm mt-0.5 text-error-600">{error.message}</p>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 bg-success-50 rounded-full flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-success-500" />
        </div>
        <p className="text-secondary-700 font-medium">All caught up!</p>
        <p className="text-sm text-secondary-400">No pending leave requests require your approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map(req => {
        const allowed = canApprove(req.leave_types);
        const level = req.leave_types?.approval_level;
        const levelLabel = { any: 'Any', manager: 'Manager', hr: 'HR', admin: 'Admin' }[level] || 'Any';

        return (
          <div key={req.id} className="card p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700">
                    {req.employees?.first_name?.[0]}{req.employees?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-secondary-900">{req.employees?.first_name} {req.employees?.last_name}</p>
                  <p className="text-xs text-secondary-400">{req.employees?.employee_id}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: req.leave_types?.color || '#6b7280' }} />
                      <span className="text-sm text-secondary-700">{req.leave_types?.name}</span>
                      {req.leave_types && !req.leave_types.is_paid && <Badge variant="warning" size="xs">Unpaid</Badge>}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-secondary-500">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>{formatDate(req.start_date)} – {formatDate(req.end_date)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" />
                      <span>{req.days_requested} day{req.days_requested !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {req.reason && (
                    <p className="mt-2 text-xs text-secondary-500 italic">"{req.reason}"</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {level && level !== 'any' && (
                  <div className="flex items-center gap-1 text-xs text-secondary-500">
                    <User className="w-3.5 h-3.5" />
                    <span>Requires: <span className="font-semibold text-secondary-700">{levelLabel}</span></span>
                  </div>
                )}
                {allowed ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(req.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-success-600 text-white text-sm font-medium rounded-lg hover:bg-success-700 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => onReject(req.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-error-600 text-sm font-medium rounded-lg border border-error-200 hover:bg-error-50 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-secondary-400 italic">Approval requires {levelLabel} role</span>
                )}
                <p className="text-xs text-secondary-400">Submitted {formatDate(req.created_at?.split('T')[0])}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaveBalancesTab({ companyId }) {
  const [empFilter, setEmpFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: balances = [], isLoading } = useLeaveBalances(empFilter || null, yearFilter ? parseInt(yearFilter) : null, companyId);
  const initBalances = useInitLeaveBalances(companyId);
  const [initializing, setInitializing] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  async function handleInitAll() {
    if (!window.confirm(`Initialize ${yearFilter} leave balances for all active employees? Existing records won't be overwritten.`)) return;
    setInitializing(true);
    try {
      for (const emp of employees) {
        await initBalances.mutateAsync({ employeeId: emp.id, year: parseInt(yearFilter) });
      }
    } finally {
      setInitializing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Select value={empFilter} onChange={e => setEmpFilter(e.target.value)} className="w-64">
            <option value="">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}
          </Select>
          <Select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="w-32">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <button onClick={handleInitAll} disabled={initializing} className="btn-secondary text-sm">
          {initializing ? 'Initializing...' : `Init ${yearFilter} Balances`}
        </button>
      </div>
      <div className="card">
        <Table columns={[
          { header: 'Employee', key: 'employee_id', render: (_, row) => { const emp = employees.find(e => e.id === row.employee_id); return emp ? `${emp.first_name} ${emp.last_name}` : '–'; }},
          { header: 'Leave Type', key: 'leave_types', render: (v) => <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:v?.color}}/>{v?.name}</div> },
          { header: 'Entitled', key: 'entitled_days', render: v => `${v}d` },
          { header: 'Carried Fwd', key: 'carried_forward', render: v => `${v ?? 0}d` },
          { header: 'Used', key: 'used_days', render: v => `${v}d` },
          { header: 'Pending', key: 'pending_days', render: v => `${v}d` },
          { header: 'Balance', key: 'entitled_days', render: (_, row) => { const bal = row.entitled_days + (row.carried_forward || 0) - row.used_days - row.pending_days; return <span className={`font-semibold ${bal < 0 ? 'text-error-600' : bal === 0 ? 'text-warning-600' : 'text-success-600'}`}>{bal}d</span>; }},
        ]} data={balances} loading={isLoading} emptyMessage="No leave balances found." />
      </div>
    </div>
  );
}

function LeaveTypesTab() {
  const { companyId } = useAuth();
  const { data: types = [], isLoading } = useLeaveTypes(companyId);
  const approvalLabels = { any: 'Any', manager: 'Manager', hr: 'HR', admin: 'Admin' };
  return (
    <div className="card">
      <Table columns={[
        { header: 'Leave Type', key: 'name', render: (v, row) => <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{background:row.color}}/><span className="font-medium">{v}</span><span className="text-xs text-secondary-400">({row.code})</span></div> },
        { header: 'Days/Year', key: 'days_per_year', render: v => `${v} days` },
        { header: 'Paid', key: 'is_paid', render: v => <Badge variant={v ? 'success' : 'warning'}>{v ? 'Paid' : 'Unpaid'}</Badge> },
        { header: 'Approval', key: 'approval_level', render: v => <Badge variant="secondary">{approvalLabels[v] || 'Any'}</Badge> },
        { header: 'Min Notice', key: 'min_days_notice', render: v => v ? `${v}d` : '–' },
        { header: 'Max Carryover', key: 'max_carryforward', render: v => v != null ? `${v}d` : '–' },
        { header: 'Doc Required', key: 'require_document', render: v => v ? <Badge variant="warning">Yes</Badge> : <span className="text-secondary-400 text-xs">No</span> },
        { header: 'Applies To', key: 'gender_specific' },
      ]} data={types} loading={isLoading} />
    </div>
  );
}

function LeaveRequestForm({ companyId, onClose }) {
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: leaveTypes = [] } = useLeaveTypes(companyId);
  const createLeave = useCreateLeaveRequest(companyId);
  const { register, handleSubmit, watch } = useForm({ defaultValues: {} });
  const startDate = watch('start_date'), endDate = watch('end_date');
  const days = startDate && endDate ? Math.max(1, differenceInBusinessDays(parseISO(endDate), parseISO(startDate)) + 1) : 0;

  return (
    <Modal isOpen onClose={onClose} title="New Leave Request" size="md"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSubmit(async d => { try { await createLeave.mutateAsync({...d, days_requested: days, year: new Date(d.start_date).getFullYear()}); onClose(); } catch(e) { alert(e.message); } })} disabled={createLeave.isPending} className="btn-primary">{createLeave.isPending ? 'Submitting...' : 'Submit'}</button></div>}>
      <form className="space-y-4">
        <FormField label="Employee" required><Select {...register('employee_id', {required:true})}><option value="">Select employee...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}</Select></FormField>
        <FormField label="Leave Type" required><Select {...register('leave_type_id', {required:true})}><option value="">Select type...</option>{leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Start Date" required><Input {...register('start_date', {required:true})} type="date" /></FormField>
          <FormField label="End Date" required><Input {...register('end_date', {required:true})} type="date" /></FormField>
        </div>
        {days > 0 && <div className="p-3 bg-primary-50 rounded-lg text-sm text-primary-700"><strong>{days} working days</strong> requested</div>}
        <FormField label="Reason"><Textarea {...register('reason')} rows={3} /></FormField>
      </form>
    </Modal>
  );
}

function LeaveBalanceImportModal({ companyId, onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const qc = useQueryClient();

  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: leaveTypes = [] } = useLeaveTypes(companyId);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  async function handleFileSelect(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParseError('');
    setResults(null);
    try {
      const parsed = await parseLeaveBalanceImport(f);
      setPreview(parsed);
    } catch (err) {
      setParseError(err.message);
      setPreview(null);
    }
  }

  async function handleImport() {
    if (!preview?.length) return;
    setImporting(true);
    const errs = [];
    let success = 0;

    const empIdMap = Object.fromEntries(employees.map(e => [e.employee_id?.toLowerCase(), e.id]));
    const leaveCodeMap = Object.fromEntries(leaveTypes.map(t => [t.code?.toUpperCase(), t.id]));

    for (const row of preview) {
      const employeeUuid = empIdMap[row.employee_id_str?.toLowerCase()];
      const leaveTypeId = leaveCodeMap[row.leave_code?.toUpperCase()];

      if (!employeeUuid) { errs.push(`Employee ID "${row.employee_id_str}" not found`); continue; }
      if (!leaveTypeId) { errs.push(`Leave code "${row.leave_code}" not found`); continue; }

      const { error } = await supabase.from('leave_balances').upsert({
        employee_id: employeeUuid,
        leave_type_id: leaveTypeId,
        year: parseInt(year),
        entitled_days: row.entitled,
        used_days: row.used,
        carried_forward: row.carried,
        pending_days: 0,
        company_id: companyId,
      }, { onConflict: 'employee_id,leave_type_id,year' });

      if (error) { errs.push(`${row.employee_id_str} / ${row.leave_code}: ${error.message}`); }
      else { success++; }
    }

    qc.invalidateQueries({ queryKey: ['leave-balances'] });
    setResults({ success, failed: errs.length, errors: errs });
    setImporting(false);
  }

  return (
    <Modal isOpen onClose={onClose} title="Import Leave Balances" size="lg"
      footer={
        <div className="flex justify-between items-center">
          <button onClick={() => downloadLeaveBalanceTemplate(leaveTypes)} className="btn-secondary text-sm">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Download Template
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Close</button>
            {preview?.length > 0 && !results && (
              <button onClick={handleImport} disabled={importing} className="btn-primary">
                {importing ? 'Importing...' : `Import ${preview.length} row${preview.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      }>
      <div className="space-y-4">
        {!results ? (
          <>
            <div className="flex items-center gap-3">
              <FormField label="Year" className="w-32">
                <Select value={year} onChange={e => setYear(e.target.value)} className="w-32">
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </Select>
              </FormField>
            </div>
            <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl text-sm text-primary-700">
              <p className="font-semibold mb-1">Import instructions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Download the template to see required format</li>
                <li>Employee ID must match an existing employee's ID exactly</li>
                <li>Leave Code must match an existing leave type code (e.g. AL, SL)</li>
                <li>Existing balances for the same employee/type/year will be overwritten</li>
              </ul>
            </div>
            <div
              className="border-2 border-dashed border-secondary-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-8 h-8 text-secondary-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-secondary-700">{file ? file.name : 'Click to select Excel or CSV file'}</p>
              <p className="text-xs text-secondary-400 mt-1">.xlsx, .xls, .csv supported</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
            </div>
            {parseError && <div className="p-3 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">{parseError}</div>}
            {preview?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-secondary-700">{preview.length} row{preview.length !== 1 ? 's' : ''} ready to import</p>
                <div className="max-h-48 overflow-y-auto border border-secondary-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary-50 sticky top-0">
                      <tr>{['Employee ID', 'Leave Code', 'Entitled', 'Used', 'Carried Fwd'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-secondary-600">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-t border-secondary-100">
                          <td className="px-3 py-2 font-medium">{r.employee_id_str}</td>
                          <td className="px-3 py-2">{r.leave_code}</td>
                          <td className="px-3 py-2">{r.entitled}</td>
                          <td className="px-3 py-2">{r.used}</td>
                          <td className="px-3 py-2">{r.carried}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${results.failed === 0 ? 'bg-success-50 border-success-200' : 'bg-warning-50 border-warning-200'}`}>
              <CheckCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${results.failed === 0 ? 'text-success-600' : 'text-warning-600'}`} />
              <div>
                <p className="font-semibold text-secondary-800">Import Complete</p>
                <p className="text-sm text-secondary-600">{results.success} imported successfully{results.failed > 0 ? `, ${results.failed} failed` : ''}</p>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div className="p-3 bg-error-50 border border-error-200 rounded-lg space-y-1 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-error-700">Failed records:</p>
                {results.errors.map((e, i) => <p key={i} className="text-xs text-error-600">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
