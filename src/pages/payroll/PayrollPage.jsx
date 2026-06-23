import { useState, useRef } from 'react';
import { Plus, Eye, CheckCircle, ChevronRight, LayoutGrid, User, Save, Printer, X } from 'lucide-react';
import {
  usePayrollRuns, usePayrollLineItems,
  useCreatePayrollRunWithItems, useSaveDraftItems,
  useApprovePayrollRun, usePayrollSettings,
} from '../../hooks/usePayroll';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { Table, StatCard } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FormField, Select } from '../../components/ui/Form';
import { formatCurrency } from '../../lib/calculations';
import PayrollBulkGrid from './PayrollBulkGrid';
import SalarySlip from './SalarySlip';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const { companyId } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [editRun, setEditRun] = useState(null);
  const [slipEmployee, setSlipEmployee] = useState(null);

  const { data: runs = [], isLoading } = usePayrollRuns(companyId);

  const columns = [
    { header: 'Period', key: 'month', render: (v, row) => <span className="font-medium">{MONTHS[v - 1]} {row.year}</span> },
    { header: 'Employees', key: 'total_employees', render: v => v ?? '–' },
    { header: 'Gross', key: 'total_gross', render: v => formatCurrency(v), cellClassName: 'font-mono' },
    { header: 'Deductions', key: 'total_deductions', render: v => formatCurrency(v), cellClassName: 'font-mono' },
    { header: 'Net Pay', key: 'total_net', render: v => <span className="font-semibold text-success-700">{formatCurrency(v)}</span>, cellClassName: 'font-mono' },
    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
    {
      header: 'Actions', key: 'id',
      render: (_, row) => (
        <button onClick={() => setEditRun(row)} className="btn-ghost py-1 px-2 text-xs">
          <Eye className="w-3.5 h-3.5" />
          {row.status === 'Draft' ? 'Edit Draft' : 'View'}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Payroll</h2>
          <p className="text-sm text-secondary-500">Monthly salary processing and slip generation</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> New Payroll Run
        </button>
      </div>

      {runs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Runs" value={runs.length} />
          <StatCard label="Last Gross" value={formatCurrency(runs[0]?.total_gross)} color="blue" />
          <StatCard label="Last Deductions" value={formatCurrency(runs[0]?.total_deductions)} color="yellow" />
          <StatCard label="Last Net Pay" value={formatCurrency(runs[0]?.total_net)} color="green" />
        </div>
      )}

      <div className="card">
        <Table columns={columns} data={runs} loading={isLoading} emptyMessage="No payroll runs yet. Click 'New Payroll Run' to get started." />
      </div>

      {showNew && (
        <NewRunModal
          companyId={companyId}
          onClose={() => setShowNew(false)}
        />
      )}
      {editRun && (
        <PayrollRunModal
          run={editRun}
          companyId={companyId}
          onClose={() => setEditRun(null)}
          onViewSlip={setSlipEmployee}
        />
      )}
      {slipEmployee && (
        <SalarySlip employee={slipEmployee} onClose={() => setSlipEmployee(null)} />
      )}
    </div>
  );
}

// ─── Step 1: choose month/year + mode ────────────────────────────────────────

function NewRunModal({ companyId, onClose }) {
  const [step, setStep] = useState(1);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [mode, setMode] = useState(null); // 'bulk' | 'individual'

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1);

  if (step === 2) {
    return (
      <PayrollEditorModal
        companyId={companyId}
        month={month}
        year={year}
        mode={mode}
        onClose={onClose}
      />
    );
  }

  return (
    <Modal isOpen onClose={onClose} title="New Payroll Run" size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            disabled={!mode}
            onClick={() => setStep(2)}
            className="btn-primary"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Month">
            <Select value={month} onChange={e => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </Select>
          </FormField>
          <FormField label="Year">
            <Select value={year} onChange={e => setYear(Number(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </Select>
          </FormField>
        </div>

        <div>
          <p className="text-sm font-medium text-secondary-700 mb-2">Processing mode</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${mode === 'bulk' ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 hover:border-secondary-300 bg-white'}`}
            >
              <LayoutGrid className={`w-5 h-5 mb-2 ${mode === 'bulk' ? 'text-primary-600' : 'text-secondary-400'}`} />
              <p className={`font-semibold text-sm ${mode === 'bulk' ? 'text-primary-700' : 'text-secondary-700'}`}>Bulk Processing</p>
              <p className="text-xs text-secondary-500 mt-0.5">All employees loaded into a spreadsheet grid</p>
            </button>
            <button
              type="button"
              onClick={() => setMode('individual')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${mode === 'individual' ? 'border-primary-500 bg-primary-50' : 'border-secondary-200 hover:border-secondary-300 bg-white'}`}
            >
              <User className={`w-5 h-5 mb-2 ${mode === 'individual' ? 'text-primary-600' : 'text-secondary-400'}`} />
              <p className={`font-semibold text-sm ${mode === 'individual' ? 'text-primary-700' : 'text-secondary-700'}`}>Individual</p>
              <p className="text-xs text-secondary-500 mt-0.5">Add employees one at a time to this run</p>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Editor: full-screen grid for creating a new run ────────────────────────

function PayrollEditorModal({ companyId, month, year, mode, onClose }) {
  const gridRef = useRef();
  const { data: settings } = usePayrollSettings(companyId);
  const { data: allEmployees = [] } = useEmployees({ status: 'Active' }, companyId);
  const createRun = useCreatePayrollRunWithItems(companyId);

  const employees = mode === 'bulk' ? allEmployees : [];

  const handleSave = async (saveAsDraft) => {
    const rows = gridRef.current?.getRows() ?? [];
    if (!rows.length) { alert('Add at least one employee before saving.'); return; }
    try {
      await createRun.mutateAsync({ month, year, items: rows, saveAsDraft });
      onClose();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-secondary-200 bg-secondary-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary-200 text-secondary-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900">
              New Payroll Run — {MONTHS[month - 1]} {year}
            </h2>
            <p className="text-xs text-secondary-500">{mode === 'bulk' ? 'Bulk mode' : 'Individual mode'} · Edit values then save as draft or approve directly</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave(true)}
            disabled={createRun.isPending}
            className="btn-secondary text-sm"
          >
            <Save className="w-4 h-4" />
            {createRun.isPending ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={createRun.isPending}
            className="btn-primary text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Approve & Process
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden p-4">
        <PayrollBulkGrid
          ref={gridRef}
          employees={employees}
          availableEmployees={allEmployees}
          settings={settings}
          month={month}
          year={year}
        />
      </div>
    </div>
  );
}

// ─── View/edit existing run ──────────────────────────────────────────────────

function PayrollRunModal({ run, companyId, onClose, onViewSlip }) {
  const gridRef = useRef();
  const { data: items = [], isLoading } = usePayrollLineItems(run.id);
  const { data: allEmployees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: settings } = usePayrollSettings(companyId);
  const saveDraft = useSaveDraftItems();
  const approveRun = useApprovePayrollRun();
  const { user } = useAuth();

  const isDraft = run.status === 'Draft';

  const handleSaveDraft = async () => {
    const rows = gridRef.current?.getRows() ?? [];
    try {
      await saveDraft.mutateAsync({ runId: run.id, companyId, items: rows });
    } catch (e) { alert(e.message); }
  };

  const handleApprove = async () => {
    if (isDraft) {
      const rows = gridRef.current?.getRows() ?? [];
      try {
        await saveDraft.mutateAsync({ runId: run.id, companyId, items: rows });
      } catch (e) { alert(e.message); return; }
    }
    try {
      await approveRun.mutateAsync({ id: run.id, approvedBy: user?.email || 'HR Manager' });
      onClose();
    } catch (e) { alert(e.message); }
  };

  const busy = saveDraft.isPending || approveRun.isPending;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-secondary-400">Loading payroll data…</p>
        </div>
      </div>
    );
  }

  if (!isDraft) {
    return (
      <ReadOnlyRunModal
        run={run}
        items={items}
        onClose={onClose}
        onViewSlip={onViewSlip}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-secondary-200 bg-amber-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-amber-100 text-secondary-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold text-secondary-900">
              Draft — {MONTHS[run.month - 1]} {run.year}
            </h2>
            <p className="text-xs text-amber-700">Editing draft. Save changes before approving.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSaveDraft} disabled={busy} className="btn-secondary text-sm">
            <Save className="w-4 h-4" />
            {saveDraft.isPending ? 'Saving…' : 'Save Draft'}
          </button>
          <button onClick={handleApprove} disabled={busy} className="btn-primary text-sm">
            <CheckCircle className="w-4 h-4" />
            {approveRun.isPending ? 'Approving…' : 'Approve Payroll'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden p-4">
        <PayrollBulkGrid
          ref={gridRef}
          employees={allEmployees}
          settings={settings}
          month={run.month}
          year={run.year}
          existingItems={items}
        />
      </div>
    </div>
  );
}

// ─── Read-only approved run ───────────────────────────────────────────────────

function ReadOnlyRunModal({ run, items, onClose, onViewSlip }) {
  const columns = [
    {
      header: 'Employee',
      key: 'employees',
      render: v => v ? (
        <div>
          <p className="text-sm font-medium">{v.first_name} {v.last_name}</p>
          <p className="text-xs text-secondary-400">{v.employee_id}</p>
        </div>
      ) : '–',
    },
    { header: 'Basic', key: 'basic_salary', render: v => formatCurrency(v), cellClassName: 'font-mono text-sm' },
    {
      header: 'Allowances', key: 'housing_allowance',
      render: (_, row) => formatCurrency(
        (row.housing_allowance || 0) + (row.transport_allowance || 0) + (row.food_allowance || 0) + (row.other_allowances || 0)
      ),
      cellClassName: 'font-mono text-sm',
    },
    { header: 'OT / Bonus', key: 'overtime_amount', render: (v, row) => formatCurrency((v || 0) + (row.bonus || 0)), cellClassName: 'font-mono text-sm' },
    { header: 'Gross', key: 'gross_salary', render: v => <span className="font-semibold">{formatCurrency(v)}</span>, cellClassName: 'font-mono text-sm' },
    { header: 'GOSI Emp', key: 'gosi_employee', render: v => v > 0 ? <span className="text-error-600">{formatCurrency(v)}</span> : '–', cellClassName: 'font-mono text-sm' },
    { header: 'GOSI Er.', key: 'gosi_employer', render: v => v > 0 ? <span className="text-orange-600">{formatCurrency(v)}</span> : '–', cellClassName: 'font-mono text-sm' },
    { header: 'Deductions', key: 'total_deductions', render: v => v > 0 ? <span className="text-error-600">{formatCurrency(v)}</span> : '–', cellClassName: 'font-mono text-sm' },
    { header: 'Net', key: 'net_salary', render: v => <span className="font-bold text-success-700">{formatCurrency(v)}</span>, cellClassName: 'font-mono text-sm' },
    {
      header: 'Slip', key: 'id',
      render: (_, row) => (
        <button onClick={() => onViewSlip({ item: row, run })} className="btn-ghost py-1 px-2 text-xs">
          <Printer className="w-3 h-3" /> Slip
        </button>
      ),
    },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Payroll – ${MONTHS[run.month - 1]} ${run.year}`}
      size="2xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary-500">
            {items.length} employees · Gross: <strong>{formatCurrency(run.total_gross)}</strong> · Net: <strong>{formatCurrency(run.total_net)}</strong>
          </div>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Total Gross', formatCurrency(run.total_gross), 'text-secondary-800'],
          ['Total Deductions', formatCurrency(run.total_deductions), 'text-error-700'],
          ['Total Net Pay', formatCurrency(run.total_net), 'text-success-700'],
        ].map(([label, val, cls]) => (
          <div key={label} className="bg-secondary-50 rounded-lg p-3">
            <p className="text-xs text-secondary-400">{label}</p>
            <p className={`text-base font-bold mt-0.5 font-mono ${cls}`}>{val}</p>
          </div>
        ))}
      </div>
      <Table columns={columns} data={items} />
    </Modal>
  );
}
