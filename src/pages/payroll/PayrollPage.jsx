import { useState, useRef } from 'react';
import { Plus, Eye, CheckCircle, ChevronRight, LayoutGrid, User, Save, Printer, X, Trash2, FileSpreadsheet, FileDown, RefreshCw } from 'lucide-react';
import {
  usePayrollRuns, usePayrollLineItems,
  useCreatePayrollRunWithItems, useSaveDraftItems,
  useApprovePayrollRun, usePayrollSettings, useDeletePayrollRun, usePayrollFormulas,
  useStatutoryContext, usePayslipTemplate, useModuleSettings, useStatutoryRules,
} from '../../hooks/usePayroll';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useBulkFieldValuesByKey } from '../../hooks/useCustomFields';
import { useEmployees } from '../../hooks/useEmployees';
import { useApprovedLeaveForMonth } from '../../hooks/useLeave';
import { useAuth } from '../../contexts/AuthContext';
import { Table, StatCard } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Select } from '../../components/ui/Form';
import { formatCurrency } from '../../lib/calculations';
import { exportPayrollToExcel } from '../../lib/excelUtils';
import { generateWpsSif, generatePfEcr, downloadTextFile } from '../../lib/statutoryFiles';
import PayrollBulkGrid from './PayrollBulkGrid';
import SalarySlip from './SalarySlip';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Rolls each row's period amounts into the employee's YTD balance — only
// meaningful for countries running the statutory engine with YTD context
// (GB/IN/US); Bahrain's legacy GOSI path doesn't track YTD.
function buildYtdUpdates(rows, statutory, periodEnd) {
  if (!statutory?.taxYear || !statutory.countryCode || statutory.countryCode === 'BH') return [];
  return rows.map(row => {
    const breakdown = row._statutoryBreakdown || [];
    const findAmt = code => breakdown.find(b => b.code === code)?.employee;
    const deltas = { GROSS: row.gross_salary || 0 };
    const paye = findAmt('PAYE'); if (paye) deltas.PAYE = paye;
    const tds = findAmt('TDS'); if (tds) deltas.TDS = tds;
    const ssWages = row._statutoryWageBases?.ssWages; if (ssWages) deltas.SS_WAGES = ssWages;
    return {
      employeeId: row.employee_id,
      countryCode: statutory.countryCode,
      taxYear: statutory.taxYear,
      periodEnd,
      deltas,
    };
  });
}

export default function PayrollPage() {
  const { companyId, canDeletePayroll } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [editRun, setEditRun] = useState(null);
  const [slipEmployee, setSlipEmployee] = useState(null);
  const [deletingRun, setDeletingRun] = useState(null);

  const { data: runs = [], isLoading } = usePayrollRuns(companyId);
  const deleteRun = useDeletePayrollRun(companyId);

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
        <div className="flex items-center gap-1">
          <button onClick={() => setEditRun(row)} className="btn-ghost py-1 px-2 text-xs">
            <Eye className="w-3.5 h-3.5" />
            {row.status === 'Draft' ? 'Edit Draft' : 'View'}
          </button>
          {canDeletePayroll && (
            <button
              onClick={() => setDeletingRun(row)}
              className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors"
              title={`Delete ${row.status} run`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
      <ConfirmModal
        isOpen={!!deletingRun}
        onClose={() => setDeletingRun(null)}
        onConfirm={async () => { await deleteRun.mutateAsync(deletingRun.id); setDeletingRun(null); }}
        loading={deleteRun.isPending}
        title="Delete Payroll Run"
        confirmText="Delete"
        confirmVariant="danger"
        message={
          deletingRun?.status === 'Approved'
            ? `This will permanently delete the approved payroll run for ${MONTHS[(deletingRun?.month ?? 1) - 1]} ${deletingRun?.year} and all its line items. This cannot be undone.`
            : `Delete draft payroll for ${MONTHS[(deletingRun?.month ?? 1) - 1]} ${deletingRun?.year}? All unsaved data will be lost.`
        }
      />
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
  const { data: leaveMap = {}, isLoading: leaveLoading } = useApprovedLeaveForMonth(companyId, month, year);
  const { data: calcFormulas = {} } = usePayrollFormulas();
  const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10); // last day of `month`
  const statutory = useStatutoryContext(periodEnd);
  const createRun = useCreatePayrollRunWithItems(companyId);

  const employees = mode === 'bulk' ? allEmployees : [];

  const handleSave = async (saveAsDraft) => {
    const rows = gridRef.current?.getRows() ?? [];
    if (!rows.length) { alert('Add at least one employee before saving.'); return; }
    try {
      const ytdUpdates = saveAsDraft ? [] : buildYtdUpdates(rows, statutory, periodEnd);
      await createRun.mutateAsync({ month, year, items: rows, saveAsDraft, companyId, ytdUpdates });
      onClose();
    } catch (e) { alert(e.message); }
  };

  // Show spinner until leave data resolves so the grid initialises with correct leave days
  if (leaveLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-secondary-400">Loading leave records…</p>
        </div>
      </div>
    );
  }

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
          leaveMap={leaveMap}
          calcFormulas={calcFormulas}
          statutory={statutory}
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
  const { data: leaveMap = {} } = useApprovedLeaveForMonth(companyId, run.month, run.year);
  const { data: calcFormulas = {} } = usePayrollFormulas();
  const periodEnd = new Date(run.year, run.month, 0).toISOString().slice(0, 10);
  const statutory = useStatutoryContext(periodEnd);
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
    const rows = gridRef.current?.getRows() ?? [];
    if (isDraft) {
      try {
        await saveDraft.mutateAsync({ runId: run.id, companyId, items: rows });
      } catch (e) { alert(e.message); return; }
    }
    try {
      const ytdUpdates = buildYtdUpdates(rows, statutory, periodEnd);
      await approveRun.mutateAsync({ id: run.id, approvedBy: user?.email || 'HR Manager', companyId, ytdUpdates });
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
          <button
            onClick={() => gridRef.current?.syncLeave(leaveMap)}
            disabled={busy}
            className="btn-secondary text-sm"
            title="Re-read approved leave records and update leave days in the grid"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Leave
          </button>
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
          calcFormulas={calcFormulas}
          statutory={statutory}
          month={run.month}
          year={run.year}
          existingItems={items}
        />
      </div>
    </div>
  );
}

// Builds and downloads the country's statutory compliance file for a run
// (WPS SIF for AE/BH, PF ECR for IN) — see src/lib/statutoryFiles.js for
// the format documentation and the "verify with your bank" caveat on WPS.
function useStatutoryFileExport({ companyId, run, items, countryCode, currencyCode }) {
  const [loading, setLoading] = useState(false);
  const isWps = countryCode === 'AE' || countryCode === 'BH';
  const isPf = countryCode === 'IN';
  const employeeIds = items.map(i => i.employee_id);

  const { data: wpsSettings } = useModuleSettings(companyId, countryCode, 'WPS');
  const { data: wpsFieldValues } = useBulkFieldValuesByKey(isWps ? employeeIds : [], ['wps_person_id']);
  const { data: pfFieldValues } = useBulkFieldValuesByKey(isPf ? employeeIds : [], ['uan']);
  const { data: pfRuleRows } = useStatutoryRules(isPf ? 'IN' : null);

  if (!isWps && !isPf) return { available: false };

  const download = async () => {
    setLoading(true);
    try {
      if (isWps) {
        if (!wpsSettings?.wpsEstablishmentId) {
          alert('Set your WPS establishment ID and bank details first, under Settings → Payroll Settings.');
          return;
        }
        const employeeInfo = {};
        for (const i of items) {
          employeeInfo[i.employee_id] = {
            wpsPersonId: wpsFieldValues?.[i.employee_id]?.wps_person_id || '',
            accountOrIban: i.employees?.iban || i.employees?.bank_account || '',
            bankAgentId: wpsSettings.bankShortName,
          };
        }
        const { filename, content, warnings } = generateWpsSif({
          run, items, employerSettings: wpsSettings, employeeInfo, currencyCode,
          currencyDecimals: currencyCode === 'BHD' ? 3 : 2,
        });
        if (warnings.length) alert(`${warnings.length} employee(s) are missing WPS details — check the file before submitting.\n\n${warnings.join('\n')}`);
        downloadTextFile(filename, content);
      } else {
        const ruleSet = pfRuleRows || [];
        const num = (key, fallback) => {
          const row = ruleSet.find(r => r.module_code === 'PF' && r.rule_key === key);
          return row ? Number(row.rule_value) : fallback;
        };
        const pfRules = { employeePct: num('employee_pct', 0.12), epsPct: num('eps_pct', 0.0833), wageCap: num('wage_cap', 15000) };
        const employeeInfo = {};
        for (const i of items) {
          employeeInfo[i.employee_id] = {
            uan: pfFieldValues?.[i.employee_id]?.uan || '',
            name: `${i.employees?.first_name || ''} ${i.employees?.last_name || ''}`.trim(),
          };
        }
        const { filename, content, warnings } = generatePfEcr({ run, items, employeeInfo, pfRules });
        if (warnings.length) alert(`${warnings.length} employee(s) are missing a UAN — check the file before submitting.\n\n${warnings.join('\n')}`);
        downloadTextFile(filename, content);
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return { available: true, loading, label: isWps ? 'WPS SIF' : 'PF ECR', download };
}

// ─── Read-only approved run ───────────────────────────────────────────────────

function ReadOnlyRunModal({ run, items, onClose, onViewSlip }) {
  const { company, companyId } = useAuth();
  const { config } = useCountryConfig();
  const { data: payslipTemplate } = usePayslipTemplate(config.countryCode);
  const [exporting, setExporting] = useState(false);
  const statutoryFile = useStatutoryFileExport({ companyId, run, items, countryCode: config.countryCode, currencyCode: config.locale.currencyCode });

  const handleExport = async () => {
    setExporting(true);
    try {
      const statutoryLabel = payslipTemplate?.layout?.statutoryDeductionLabel;
      await exportPayrollToExcel(run, items, company?.name, {
        currencyCode: config.locale.currencyCode,
        statutoryEeLabel: statutoryLabel,
        statutoryErLabel: statutoryLabel ? statutoryLabel.replace('(Employee)', '(Employer)') : undefined,
        nationalIdLabel: config.identity.nationalIdLabel,
      });
    } finally {
      setExporting(false);
    }
  };
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
          <div className="flex gap-2">
            {statutoryFile.available && (
              <button onClick={statutoryFile.download} disabled={statutoryFile.loading} className="btn-secondary text-sm">
                <FileDown className="w-4 h-4" />
                {statutoryFile.loading ? 'Preparing…' : statutoryFile.label}
              </button>
            )}
            <button onClick={handleExport} disabled={exporting} className="btn-secondary text-sm">
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? 'Exporting…' : 'Export to Excel'}
            </button>
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
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
