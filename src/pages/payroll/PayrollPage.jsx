import { useState, useRef } from 'react';
import { Plus, Eye, CheckCircle, Download, Printer, RefreshCw } from 'lucide-react';
import { usePayrollRuns, useCreatePayrollRun, useApprovePayrollRun, usePayrollLineItems, useUpdatePayrollItem } from '../../hooks/usePayroll';
import { useAuth } from '../../contexts/AuthContext';
import { Table, StatCard } from '../../components/ui/Table';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { FormField, Select } from '../../components/ui/Form';
import { formatDate, formatCurrency } from '../../lib/calculations';
import SalarySlip from './SalarySlip';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollPage() {
  const { companyId } = useAuth();
  const [selectedRun, setSelectedRun] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [slipEmployee, setSlipEmployee] = useState(null);

  const { data: runs = [], isLoading } = usePayrollRuns(companyId);

  const runsColumns = [
    { header: 'Period', key: 'month', render: (v, row) => <span className="font-medium">{MONTHS[v - 1]} {row.year}</span> },
    { header: 'Employees', key: 'total_employees' },
    { header: 'Gross', key: 'total_gross', render: v => formatCurrency(v), cellClassName: 'font-mono' },
    { header: 'Deductions', key: 'total_deductions', render: v => formatCurrency(v), cellClassName: 'font-mono' },
    { header: 'Net Pay', key: 'total_net', render: v => <span className="font-semibold text-success-700">{formatCurrency(v)}</span>, cellClassName: 'font-mono' },
    { header: 'Status', key: 'status', render: v => <StatusBadge status={v} /> },
    {
      header: 'Actions', key: 'id',
      render: (id, row) => (
        <div className="flex gap-1">
          <button onClick={() => setSelectedRun(row)} className="btn-ghost py-1 px-2 text-xs">
            <Eye className="w-3.5 h-3.5" /> View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Payroll</h2>
          <p className="text-sm text-secondary-500">Monthly salary processing & slip generation</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Run Payroll
        </button>
      </div>

      {/* Summary Stats */}
      {runs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Runs" value={runs.length} />
          <StatCard label="Last Gross" value={formatCurrency(runs[0]?.total_gross)} color="blue" />
          <StatCard label="Last Deductions" value={formatCurrency(runs[0]?.total_deductions)} color="yellow" />
          <StatCard label="Last Net Pay" value={formatCurrency(runs[0]?.total_net)} color="green" />
        </div>
      )}

      <div className="card">
        <Table columns={runsColumns} data={runs} loading={isLoading} emptyMessage="No payroll runs yet. Click 'Run Payroll' to generate your first payroll." />
      </div>

      {showCreateModal && <CreatePayrollModal companyId={companyId} onClose={() => setShowCreateModal(false)} />}
      {selectedRun && (
        <PayrollRunDetail
          run={selectedRun}
          onClose={() => setSelectedRun(null)}
          onViewSlip={setSlipEmployee}
        />
      )}
      {slipEmployee && (
        <SalarySlip employee={slipEmployee} onClose={() => setSlipEmployee(null)} />
      )}
    </div>
  );
}

function CreatePayrollModal({ companyId, onClose }) {
  const createRun = useCreatePayrollRun(companyId);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const handleCreate = async () => {
    try {
      await createRun.mutateAsync({ month, year });
      onClose();
    } catch (e) { alert(e.message); }
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1);

  return (
    <Modal isOpen onClose={onClose} title="Generate Payroll Run" size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCreate} disabled={createRun.isPending} className="btn-primary">
            {createRun.isPending ? 'Generating...' : 'Generate Payroll'}
          </button>
        </div>
      }>
      <p className="text-sm text-secondary-500 mb-4">
        This will generate a draft payroll for all active employees based on their current salary structure.
      </p>
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
    </Modal>
  );
}

function PayrollRunDetail({ run, onClose, onViewSlip }) {
  const { data: items = [], isLoading } = usePayrollLineItems(run.id);
  const approveRun = useApprovePayrollRun();

  const columns = [
    {
      header: 'Employee',
      key: 'employees',
      render: (v) => v ? (
        <div>
          <p className="text-sm font-medium">{v.first_name} {v.last_name}</p>
          <p className="text-xs text-secondary-400">{v.employee_id}</p>
        </div>
      ) : '–',
    },
    { header: 'Basic', key: 'basic_salary', render: v => formatCurrency(v), cellClassName: 'font-mono text-sm' },
    { header: 'Allowances', key: 'housing_allowance', render: (_, row) => formatCurrency((row.housing_allowance || 0) + (row.transport_allowance || 0) + (row.food_allowance || 0) + (row.other_allowances || 0)), cellClassName: 'font-mono text-sm' },
    { header: 'OT / Bonus', key: 'overtime_amount', render: (v, row) => formatCurrency((v || 0) + (row.bonus || 0)), cellClassName: 'font-mono text-sm' },
    { header: 'Gross', key: 'gross_salary', render: v => <span className="font-semibold">{formatCurrency(v)}</span>, cellClassName: 'font-mono text-sm' },
    { header: 'GOSI', key: 'gosi_employee', render: v => v > 0 ? <span className="text-error-600">{formatCurrency(v)}</span> : '–', cellClassName: 'font-mono text-sm' },
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
    <Modal isOpen onClose={onClose} title={`Payroll – ${MONTHS[run.month - 1]} ${run.year}`} size="2xl"
      footer={
        <div className="flex items-center justify-between">
          <div className="text-sm text-secondary-500">
            {items.length} employees · Gross: <strong>{formatCurrency(run.total_gross)}</strong> · Net: <strong>{formatCurrency(run.total_net)}</strong>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Close</button>
            {run.status === 'Draft' && (
              <button onClick={() => approveRun.mutateAsync({ id: run.id, approvedBy: 'HR Manager' })} disabled={approveRun.isPending} className="btn-primary">
                <CheckCircle className="w-4 h-4" /> Approve Payroll
              </button>
            )}
          </div>
        </div>
      }>
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
      <Table columns={columns} data={items} loading={isLoading} />
    </Modal>
  );
}
