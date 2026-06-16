import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useLookups, useCreateLookup, useUpdateLookup, useDeleteLookup } from '../../hooks/useSettings';
import { useAuth } from '../../contexts/AuthContext';
import { Table } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { FormField, Input } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';

const LOOKUP_TABS = [
  { key: 'nationality', label: 'Nationalities' },
  { key: 'country', label: 'Countries (Passport)' },
  { key: 'bank', label: 'Banks' },
  { key: 'license_type', label: 'License Types' },
  { key: 'qualification_type', label: 'Qualification Types' },
];

export default function LookupSettings() {
  const [activeType, setActiveType] = useState('nationality');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-secondary-200 flex-wrap">
        {LOOKUP_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeType === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <LookupTab type={activeType} label={LOOKUP_TABS.find(t => t.key === activeType)?.label} />
    </div>
  );
}

function LookupTab({ type, label }) {
  const { companyId } = useAuth();
  const { data: items = [], isLoading } = useLookups(type, companyId);
  const createLookup = useCreateLookup(companyId);
  const updateLookup = useUpdateLookup();
  const deleteLookup = useDeleteLookup();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const companyItems = items.filter(i => i.company_id === companyId);
  const globalItems = items.filter(i => i.company_id === null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-secondary-500">
          {globalItems.length} system defaults · {companyItems.length} company-specific
        </p>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add {label?.split(' ')[0]}
        </button>
      </div>

      {globalItems.length > 0 && (
        <div className="card">
          <div className="px-4 py-2 bg-secondary-50 border-b border-secondary-100">
            <p className="text-xs font-semibold text-secondary-500 uppercase">System Defaults</p>
          </div>
          <Table
            columns={[
              { header: 'Name', key: 'name', render: (v, row) => <div className="flex items-center gap-2"><span className="font-medium">{v}</span>{row.code && <span className="text-xs text-secondary-400">({row.code})</span>}</div> },
              { header: 'Status', key: 'is_active', render: v => <Badge variant={v ? 'success' : 'warning'}>{v ? 'Active' : 'Inactive'}</Badge> },
            ]}
            data={globalItems} loading={isLoading}
          />
        </div>
      )}

      <div className="card">
        <div className="px-4 py-2 bg-secondary-50 border-b border-secondary-100">
          <p className="text-xs font-semibold text-secondary-500 uppercase">Company Specific</p>
        </div>
        <Table
          columns={[
            { header: 'Name', key: 'name', render: (v, row) => <div className="flex items-center gap-2"><span className="font-medium">{v}</span>{row.code && <span className="text-xs text-secondary-400">({row.code})</span>}</div> },
            { header: 'Status', key: 'is_active', render: v => <Badge variant={v ? 'success' : 'warning'}>{v ? 'Active' : 'Inactive'}</Badge> },
            { header: 'Actions', key: 'id', render: (id, row) => (
              <div className="flex gap-1">
                <button onClick={() => { setEditing(row); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeletingId(id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )},
          ]}
          data={companyItems} loading={isLoading} emptyMessage="No company-specific entries. Add one above."
        />
      </div>

      {showForm && (
        <LookupForm
          type={type}
          editing={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onCreate={d => createLookup.mutateAsync({ ...d, lookup_type: type })}
          onUpdate={d => updateLookup.mutateAsync({ id: editing.id, ...d })}
        />
      )}

      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)}
        onConfirm={async () => { await deleteLookup.mutateAsync(deletingId); setDeletingId(null); }}
        title="Delete Entry" message="Remove this lookup entry?" />
    </div>
  );
}

function LookupForm({ type, editing, onClose, onCreate, onUpdate }) {
  const { register, handleSubmit } = useForm({ defaultValues: editing || { is_active: true } });
  const [loading, setLoading] = useState(false);

  async function onSubmit(data) {
    setLoading(true);
    try {
      if (editing) await onUpdate(data);
      else await onCreate(data);
      onClose();
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit Entry' : 'Add Entry'} size="sm"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSubmit(onSubmit)} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save'}</button></div>}>
      <form className="space-y-4">
        <FormField label="Name" required><Input {...register('name', { required: true })} /></FormField>
        <FormField label="Code / Abbreviation"><Input {...register('code')} placeholder="e.g. BH" /></FormField>
        <FormField label="Sort Order"><Input {...register('sort_order', { valueAsNumber: true })} type="number" placeholder="0" /></FormField>
      </form>
    </Modal>
  );
}
