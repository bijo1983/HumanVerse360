import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Upload, Download, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { useEmployees, useDeleteEmployee, useDepartments, useCreateEmployee, usePositions } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { Table } from '../../components/ui/Table';
import { StatusBadge } from '../../components/ui/Badge';
import { SearchInput, Select } from '../../components/ui/Form';
import { ConfirmModal, Modal } from '../../components/ui/Modal';
import { formatDate, formatCurrency } from '../../lib/calculations';
import { exportEmployeesToExcel, downloadEmployeeTemplate, parseEmployeeImport } from '../../lib/excelUtils';
import EmployeeForm from './EmployeeForm';

export default function EmployeeList() {
  const { companyId, isWithinEmployeeLimit } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const { data: employees, isLoading } = useEmployees({ search, status: statusFilter, department_id: deptFilter }, companyId);
  const { data: departments = [] } = useDepartments(companyId);
  const deleteEmployee = useDeleteEmployee();

  const canAddMore = isWithinEmployeeLimit(employees?.length || 0);

  const columns = [
    {
      header: 'Employee', key: 'first_name',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary-700">{row.first_name[0]}{row.last_name[0]}</span>
          </div>
          <div>
            <p className="font-medium text-secondary-800 text-sm">{row.first_name} {row.last_name}</p>
            <p className="text-xs text-secondary-400">{row.employee_id}</p>
          </div>
        </div>
      ),
    },
    { header: 'Department', key: 'department_name', render: (v) => v || '–' },
    { header: 'Position', key: 'position_title', render: (v) => v || '–' },
    { header: 'Type', key: 'employment_type', render: (v) => <StatusBadge status={v} /> },
    { header: 'Status', key: 'status', render: (v) => <StatusBadge status={v} /> },
    { header: 'Joining Date', key: 'joining_date', render: (v) => formatDate(v) },
    { header: 'Basic Salary', key: 'basic_salary', render: (v) => formatCurrency(v), cellClassName: 'font-mono text-sm' },
    {
      header: 'Actions', key: 'id', cellClassName: 'w-24',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <Link to={`/employees/${id}`} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400 hover:text-primary-600 transition-colors"><Eye className="w-3.5 h-3.5" /></Link>
          <button onClick={() => { setEditingEmployee(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded-lg text-secondary-400 hover:text-primary-600 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
          <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded-lg text-secondary-400 hover:text-error-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Employees</h2>
          <p className="text-sm text-secondary-500 mt-0.5">{employees?.length || 0} total employees</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!canAddMore && (
            <Link to="/subscription" className="text-xs text-warning-700 bg-warning-50 border border-warning-200 px-3 py-1.5 rounded-lg font-medium">
              Employee limit reached — Upgrade
            </Link>
          )}
          <button onClick={() => exportEmployeesToExcel(employees || [])} className="btn-secondary text-sm">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">
            <Upload className="w-3.5 h-3.5" /> Import
          </button>
          <button onClick={() => { setEditingEmployee(null); setShowForm(true); }} disabled={!canAddMore} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or ID..." className="flex-1 min-w-48" />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Statuses</option>
          {['Active', 'Inactive', 'On Leave', 'Terminated', 'Resigned'].map(s => <option key={s}>{s}</option>)}
        </Select>
        <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-48">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>

      <div className="card">
        <Table columns={columns} data={employees} loading={isLoading} emptyMessage="No employees found. Add your first employee." />
      </div>

      {showForm && <EmployeeForm employee={editingEmployee} onClose={() => { setShowForm(false); setEditingEmployee(null); }} />}
      {showImport && <EmployeeImportModal companyId={companyId} departments={departments} onClose={() => setShowImport(false)} />}

      <ConfirmModal
        isOpen={!!deletingId} onClose={() => setDeletingId(null)}
        onConfirm={async () => { await deleteEmployee.mutateAsync(deletingId); setDeletingId(null); }}
        loading={deleteEmployee.isPending}
        title="Delete Employee" message="Are you sure? This will remove all associated records."
      />
    </div>
  );
}

function EmployeeImportModal({ companyId, departments, onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const createEmployee = useCreateEmployee(companyId);
  const { data: positions = [] } = usePositions(null, companyId);

  async function handleFileSelect(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setParseError('');
    setResults(null);
    try {
      const parsed = await parseEmployeeImport(f);
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
    const deptMap = Object.fromEntries(departments.map(d => [d.name?.toLowerCase(), d.id]));
    const posMap = Object.fromEntries(positions.map(p => [p.title?.toLowerCase(), p.id]));
    for (const emp of preview) {
      try {
        // eslint-disable-next-line no-unused-vars
        const { department_name, position_title, ...payload } = emp;
        if (department_name) payload.department_id = deptMap[department_name?.toLowerCase()] || null;
        if (position_title) payload.position_id = posMap[position_title?.toLowerCase()] || null;
        await createEmployee.mutateAsync(payload);
        success++;
      } catch (e) {
        errs.push(`${emp.first_name} ${emp.last_name}: ${e.message}`);
      }
    }
    setResults({ success, failed: errs.length, errors: errs });
    setImporting(false);
  }

  return (
    <Modal isOpen onClose={onClose} title="Import Employees" size="lg"
      footer={
        <div className="flex justify-between items-center">
          <button onClick={() => downloadEmployeeTemplate()} className="btn-secondary text-sm">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Download Template
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Close</button>
            {preview?.length > 0 && !results && (
              <button onClick={handleImport} disabled={importing} className="btn-primary">
                {importing ? 'Importing...' : `Import ${preview.length} employee${preview.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        </div>
      }>
      <div className="space-y-4">
        {!results ? (
          <>
            <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl text-sm text-primary-700">
              <p className="font-semibold mb-1">Import instructions:</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>Download the template, fill in employee data, then upload here</li>
                <li>Required columns: First Name, Last Name, Joining Date</li>
                <li>Department and Position must match existing names exactly</li>
                <li>Dates must be in YYYY-MM-DD format</li>
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
                <p className="text-sm font-semibold text-secondary-700">{preview.length} employee{preview.length !== 1 ? 's' : ''} ready to import</p>
                <div className="max-h-48 overflow-y-auto border border-secondary-200 rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary-50 sticky top-0">
                      <tr>{['Name','Employee ID','Department','Joining Date'].map(h => <th key={h} className="px-3 py-2 text-left font-semibold text-secondary-600">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.map((e, i) => (
                        <tr key={i} className="border-t border-secondary-100">
                          <td className="px-3 py-2 font-medium">{e.first_name} {e.last_name}</td>
                          <td className="px-3 py-2 text-secondary-400">{e.employee_id || 'Auto'}</td>
                          <td className="px-3 py-2">{e.department_name || '–'}</td>
                          <td className="px-3 py-2">{e.joining_date}</td>
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
