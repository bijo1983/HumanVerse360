import { useState } from 'react';
import { Plus, Edit, Trash2, AlertTriangle, Clock, ShieldAlert, CheckCircle } from 'lucide-react';
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useExpiringDocuments, useDocumentRequirements } from '../../hooks/useDocuments';
import { useEmployees } from '../../hooks/useEmployees';
import { useCustomFields, useEmployeeCustomValues } from '../../hooks/useCustomFields';
import { useAuth } from '../../contexts/AuthContext';
import { Table } from '../../components/ui/Table';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input, Select, SearchInput } from '../../components/ui/Form';
import { formatDate, getDaysUntilExpiry, getDocumentStatus } from '../../lib/calculations';
import { useForm } from 'react-hook-form';

const DOC_TYPES = ['Passport', 'Visa', 'National ID', 'Work Permit', 'Driving License', 'Health Card', 'Educational Certificate', 'Professional License', 'Other'];

export default function DocumentsPage() {
  const { companyId, company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  const [tab, setTab] = useState('alerts');
  const [showForm, setShowForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: allDocs = [], isLoading } = useDocuments({ document_type: typeFilter || undefined }, companyId);
  const { data: expiringDocs = [] } = useExpiringDocuments(90, companyId);
  const deleteDoc = useDeleteDocument();

  const filtered = allDocs.filter(d => {
    if (!search) return true;
    const name = `${d.employees?.first_name} ${d.employees?.last_name} ${d.employees?.employee_id}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const getStatusColor = (expiry) => {
    const s = getDocumentStatus(expiry);
    if (s === 'expired') return 'bg-error-50 text-error-700';
    if (s === 'critical') return 'bg-red-100 text-red-700';
    if (s === 'warning') return 'bg-warning-100 text-warning-700';
    if (s === 'alert') return 'bg-yellow-50 text-yellow-700';
    return 'bg-success-50 text-success-700';
  };

  const columns = [
    {
      header: 'Employee',
      key: 'employees',
      render: (v) => v ? (
        <div>
          <p className="text-sm font-medium text-secondary-800">{v.first_name} {v.last_name}</p>
          <p className="text-xs text-secondary-400">{v.employee_id}</p>
        </div>
      ) : '–',
    },
    { header: 'Document Type', key: 'document_type', render: v => <span className="font-medium">{v}</span> },
    { header: 'Doc Number', key: 'document_number', render: v => v || '–' },
    { header: 'Issue Date', key: 'issue_date', render: v => formatDate(v) },
    { header: 'Expiry Date', key: 'expiry_date', render: v => formatDate(v) },
    {
      header: 'Status',
      key: 'expiry_date',
      render: (v) => {
        const days = getDaysUntilExpiry(v);
        const status = getDocumentStatus(v);
        if (!v) return <Badge variant="default">No Expiry</Badge>;
        return (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getStatusColor(v)}`}>
            {days < 0 ? `Expired ${Math.abs(days)}d ago` : days === 0 ? 'Expires today' : `${days} days`}
          </span>
        );
      },
    },
    {
      header: 'Actions', key: 'id',
      render: (id, row) => (
        <div className="flex gap-1">
          <button onClick={() => { setEditingDoc(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600">
            <Edit className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const expired = expiringDocs.filter(d => getDaysUntilExpiry(d.expiry_date) < 0).length;
  const critical = expiringDocs.filter(d => { const n = getDaysUntilExpiry(d.expiry_date); return n >= 0 && n <= 30; }).length;
  const warning = expiringDocs.filter(d => { const n = getDaysUntilExpiry(d.expiry_date); return n > 30 && n <= 90; }).length;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h2 className="text-xl font-bold text-secondary-900">Documents & Expiry</h2>
          <p className="text-sm text-secondary-500">Track passport, visa, National ID, work permit and license expiries</p>
        </div>
        <button onClick={() => { setEditingDoc(null); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Document
        </button>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Expired', count: expired, color: 'bg-error-50 border-error-200 text-error-700', icon: ShieldAlert },
          { label: 'Critical (≤30d)', count: critical, color: 'bg-red-50 border-red-200 text-red-700', icon: AlertTriangle },
          { label: 'Warning (≤90d)', count: warning, color: 'bg-warning-50 border-warning-200 text-warning-700', icon: Clock },
          { label: 'Total Tracked', count: allDocs.length, color: 'bg-secondary-50 border-secondary-200 text-secondary-700', icon: CheckCircle },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`p-4 rounded-xl border ${color}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">{label}</p>
              <Icon className="w-4 h-4 opacity-70" />
            </div>
            <p className="text-2xl font-bold mt-1">{count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-secondary-200">
        {[['alerts', 'Expiry Alerts'], ['all', 'All Documents'], ['checklist', 'Compliance Checklist']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {label}
            {key === 'alerts' && expiringDocs.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-error-100 text-error-700 rounded-full">{expiringDocs.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div className="card">
          <div className="p-4 border-b border-secondary-100">
            <p className="text-sm text-secondary-500">Documents expiring within the next 90 days, sorted by urgency</p>
          </div>
          <Table
            columns={columns.filter(c => c.header !== 'Actions')}
            data={expiringDocs}
            emptyMessage="No documents expiring within 90 days. All clear!"
          />
        </div>
      )}

      {tab === 'all' && (
        <>
          <div className="card p-4 flex flex-wrap gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search employee..." className="flex-1 min-w-48" />
            <Select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-48">
              <option value="">All Types</option>
              {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div className="card">
            <Table columns={columns} data={filtered} loading={isLoading} emptyMessage="No documents found." />
          </div>
        </>
      )}

      {tab === 'checklist' && (
        <ChecklistTab companyId={companyId} countryCode={countryCode} allDocs={allDocs}
          onAddDocument={() => { setEditingDoc(null); setShowForm(true); }} />
      )}

      {showForm && (
        <DocumentForm doc={editingDoc} countryCode={countryCode} onClose={() => { setShowForm(false); setEditingDoc(null); }} />
      )}

      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={async () => { await deleteDoc.mutateAsync(deletingId); setDeletingId(null); }}
        loading={deleteDoc.isPending}
        title="Delete Document"
        message="Delete this document record? This cannot be undone."
      />
    </div>
  );
}

// Per-employee document compliance checklist driven by country requirements
function ChecklistTab({ companyId, countryCode, allDocs, onAddDocument }) {
  const [employeeId, setEmployeeId] = useState('');
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: requirements = [] } = useDocumentRequirements(countryCode, companyId);
  const { data: fieldDefs = [] } = useCustomFields('employees', companyId, countryCode);
  const { data: fieldValues = {} } = useEmployeeCustomValues(employeeId || null);

  // Resolve custom field values by field_key for applicability conditions
  const valueByKey = {};
  for (const f of fieldDefs) {
    const v = fieldValues[f.id] ?? f.default_value;
    if (v !== undefined && v !== null) valueByKey[f.field_key] = v;
  }

  function isApplicable(req) {
    const cond = req.applicable_when;
    if (!cond?.field) return true;
    const current = valueByKey[cond.field];
    if (current === undefined) return true; // unknown — show rather than hide
    if (cond.operator === 'neq') return current !== cond.value;
    if (cond.operator === 'in') return Array.isArray(cond.value) && cond.value.includes(current);
    return current === cond.value;
  }

  const empDocs = allDocs.filter(d => d.employee_id === employeeId);
  const rows = requirements.filter(isApplicable).map(req => {
    const match = empDocs.find(d => d.requirement_id === req.id || d.document_type === req.document_name);
    let status = 'missing';
    if (match) {
      status = req.has_expiry && match.expiry_date
        ? getDocumentStatus(match.expiry_date) // valid | alert | warning | critical | expired
        : 'on-file';
    }
    return { req, match, status };
  });

  const missingMandatory = rows.filter(r => r.status === 'missing' && r.req.is_mandatory).length;

  const statusBadge = (status, expiry) => {
    if (status === 'missing') return <Badge variant="error">Missing</Badge>;
    if (status === 'on-file' || status === 'valid') return <Badge variant="success">On file</Badge>;
    if (status === 'expired') return <Badge variant="error">Expired</Badge>;
    const days = getDaysUntilExpiry(expiry);
    return <Badge variant="warning">{`Expires in ${days}d`}</Badge>;
  };

  return (
    <div className="card">
      <div className="p-4 border-b border-secondary-100 flex flex-wrap items-center gap-3">
        <Select value={employeeId} onChange={e => setEmployeeId(e.target.value)} className="w-72">
          <option value="">Select employee...</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}
        </Select>
        {employeeId && (
          <p className="text-sm text-secondary-500">
            {missingMandatory === 0
              ? 'All mandatory documents are on file.'
              : `${missingMandatory} mandatory document${missingMandatory > 1 ? 's' : ''} missing.`}
          </p>
        )}
        <button onClick={onAddDocument} className="btn-secondary ml-auto"><Plus className="w-4 h-4" /> Add Document</button>
      </div>
      {!employeeId ? (
        <p className="p-6 text-sm text-secondary-400 text-center">Select an employee to view their country document checklist.</p>
      ) : (
        <Table
          columns={[
            { header: 'Document', key: 'req', render: r => (
              <div>
                <p className="text-sm font-medium text-secondary-800">
                  {r.document_name}
                  {r.is_mandatory && <span className="text-error-500 ml-1">*</span>}
                </p>
                {r.hint && <p className="text-xs text-secondary-400">{r.hint}</p>}
              </div>
            ) },
            { header: 'Number', key: 'match', render: m => m?.document_number || '–' },
            { header: 'Expiry', key: 'match', render: (m, row) => row.req.has_expiry ? formatDate(m?.expiry_date) : '–' },
            { header: 'Status', key: 'status', render: (s, row) => statusBadge(s, row.match?.expiry_date) },
          ]}
          data={rows}
          emptyMessage="No document requirements configured for this country."
        />
      )}
    </div>
  );
}

function DocumentForm({ doc, countryCode, onClose }) {
  const { companyId } = useAuth();
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const { data: requirements = [] } = useDocumentRequirements(countryCode, companyId);
  const createDoc = useCreateDocument(companyId);
  const updateDoc = useUpdateDocument();
  const { register, handleSubmit } = useForm({ defaultValues: doc || {} });

  // Country requirement names first, then the generic types
  const typeOptions = [
    ...requirements.map(r => r.document_name),
    ...DOC_TYPES.filter(t => !requirements.some(r => r.document_name === t)),
  ];

  async function onSubmit(data) {
    try {
      // Link the upload to the matching country requirement when the type matches
      const req = requirements.find(r => r.document_name === data.document_type);
      const payload = { ...data, requirement_id: req?.id ?? doc?.requirement_id ?? null };
      if (doc) await updateDoc.mutateAsync({ id: doc.id, ...payload });
      else await createDoc.mutateAsync(payload);
      onClose();
    } catch (e) { alert(e.message); }
  }

  const loading = createDoc.isPending || updateDoc.isPending;

  return (
    <Modal isOpen onClose={onClose} title={doc ? 'Edit Document' : 'Add Document'} size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : doc ? 'Update' : 'Add Document'}
          </button>
        </div>
      }>
      <form className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Employee" required className="sm:col-span-2">
          <Select {...register('employee_id', { required: true })}>
            <option value="">Select employee...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}
          </Select>
        </FormField>
        <FormField label="Document Type" required>
          <Select {...register('document_type', { required: true })}>
            <option value="">Select type...</option>
            {typeOptions.map(t => <option key={t}>{t}</option>)}
          </Select>
        </FormField>
        <FormField label="Document Number">
          <Input {...register('document_number')} placeholder="Number/Reference" />
        </FormField>
        <FormField label="Issue Date">
          <Input {...register('issue_date')} type="date" />
        </FormField>
        <FormField label="Expiry Date">
          <Input {...register('expiry_date')} type="date" />
        </FormField>
        <FormField label="Issued By">
          <Input {...register('issued_by')} placeholder="Issuing authority" />
        </FormField>
        <FormField label="Country">
          <Input {...register('country')} placeholder="Country" />
        </FormField>
        <FormField label="Notes" className="sm:col-span-2">
          <Input {...register('notes')} placeholder="Additional notes..." />
        </FormField>
      </form>
    </Modal>
  );
}
