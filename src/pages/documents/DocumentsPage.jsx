import { useState } from 'react';
import { Plus, Edit, Trash2, AlertTriangle, Clock, ShieldAlert, CheckCircle } from 'lucide-react';
import { useDocuments, useCreateDocument, useUpdateDocument, useDeleteDocument, useExpiringDocuments } from '../../hooks/useDocuments';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { Table } from '../../components/ui/Table';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input, Select, SearchInput } from '../../components/ui/Form';
import { formatDate, getDaysUntilExpiry, getDocumentStatus } from '../../lib/calculations';
import { useForm } from 'react-hook-form';

const DOC_TYPES = ['Passport', 'Visa', 'CPR', 'Work Permit', 'Driving License', 'Health Card', 'Educational Certificate', 'Professional License', 'Other'];

export default function DocumentsPage() {
  const { companyId } = useAuth();
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
          <p className="text-sm text-secondary-500">Track passport, visa, CPR, work permit and license expiries</p>
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
        {[['alerts', 'Expiry Alerts'], ['all', 'All Documents']].map(([key, label]) => (
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

      {showForm && (
        <DocumentForm doc={editingDoc} onClose={() => { setShowForm(false); setEditingDoc(null); }} />
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

function DocumentForm({ doc, onClose }) {
  const { companyId } = useAuth();
  const { data: employees = [] } = useEmployees({ status: 'Active' }, companyId);
  const createDoc = useCreateDocument(companyId);
  const updateDoc = useUpdateDocument();
  const { register, handleSubmit } = useForm({ defaultValues: doc || {} });

  async function onSubmit(data) {
    try {
      if (doc) await updateDoc.mutateAsync({ id: doc.id, ...data });
      else await createDoc.mutateAsync(data);
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
            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
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
