import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import {
  Users, Plus, Edit, Trash2, ToggleLeft, ToggleRight, Mail, Shield, Save, UserCheck,
} from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { FormField, Select, Input } from '../../components/ui/Form';
import { MODULE_LABELS } from '../../lib/plans';

const ALL_MODULES = Object.keys(MODULE_LABELS);

const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  hr: 'HR',
  viewer: 'Viewer',
};

const ROLE_COLORS = {
  admin: 'bg-error-50 text-error-700 border-error-200',
  manager: 'bg-primary-50 text-primary-700 border-primary-200',
  hr: 'bg-success-50 text-success-700 border-success-200',
  viewer: 'bg-secondary-100 text-secondary-600 border-secondary-200',
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useCompanyUsers(companyId) {
  return useQuery({
    queryKey: ['company-users', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_users')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

function useUserModules(companyId, userId) {
  return useQuery({
    queryKey: ['user-modules', companyId, userId],
    enabled: !!companyId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_user_modules')
        .select('module')
        .eq('company_id', companyId)
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []).map(r => r.module);
    },
  });
}

function useSetUserModules(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, modules }) => {
      const { error: delErr } = await supabase
        .from('company_user_modules')
        .delete()
        .eq('company_id', companyId)
        .eq('user_id', userId);
      if (delErr) throw delErr;

      if (modules.length > 0) {
        const rows = modules.map(m => ({ company_id: companyId, user_id: userId, module: m }));
        const { error: insErr } = await supabase.from('company_user_modules').insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['user-modules', companyId, vars.userId] });
      qc.invalidateQueries({ queryKey: ['my-module-grants', companyId] });
    },
  });
}

function useInviteUser(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, fullName, role, modules }) => {
      // Try to find existing auth user
      const { data: existing } = await supabase
        .from('company_users')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', email)
        .maybeSingle();
      if (existing) throw new Error('This user is already in the company.');

      // Register them via supabase — they'll get an invite email
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email,
        password: crypto.randomUUID(), // random, user must reset
        options: { data: { full_name: fullName } },
      });
      if (authErr) throw authErr;

      const userId = authData.user?.id;
      if (!userId) throw new Error('Could not create user.');

      const { error: cuErr } = await supabase.from('company_users').insert({
        company_id: companyId,
        user_id: userId,
        full_name: fullName,
        email,
        role,
        is_active: true,
      });
      if (cuErr) throw cuErr;

      // Save module access if any selected
      if (modules && modules.length > 0) {
        const rows = modules.map(m => ({ company_id: companyId, user_id: userId, module: m }));
        await supabase.from('company_user_modules').insert(rows);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users', companyId] }),
  });
}

function useUpdateUser(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, is_active }) => {
      const { error } = await supabase.from('company_users').update({ role, is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users', companyId] }),
  });
}

function useDeactivateUser(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('company_users').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users', companyId] }),
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { companyId, user: currentUser, userRole } = useAuth();
  const { data: users = [], isLoading } = useCompanyUsers(companyId);
  const [inviting, setInviting] = useState(false);
  const [editingModules, setEditingModules] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const deactivate = useDeactivateUser(companyId);

  const canManage = userRole === 'admin' || userRole === 'manager';

  const columns = [
    {
      header: 'User', key: 'full_name',
      render: (v, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
            {(v || row.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-secondary-800 text-sm">{v || '–'}</p>
            <p className="text-xs text-secondary-400">{row.email || '–'}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Role', key: 'role',
      render: (v) => (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${ROLE_COLORS[v] || ROLE_COLORS.viewer}`}>
          {ROLE_LABELS[v] || v}
        </span>
      ),
    },
    {
      header: 'Status', key: 'is_active',
      render: v => (
        <span className={`text-xs font-medium ${v ? 'text-success-600' : 'text-secondary-400'}`}>
          {v ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      header: 'Module Access', key: 'user_id',
      render: (userId) => <ModuleCount companyId={companyId} userId={userId} />,
    },
    {
      header: '', key: 'id',
      render: (_, row) => {
        if (!canManage || row.user_id === currentUser?.id) return null;
        return (
          <div className="flex gap-1">
            <button onClick={() => setEditingModules(row)}
              title="Manage module access"
              className="p-1.5 hover:bg-primary-50 rounded text-secondary-400 hover:text-primary-600 transition-colors">
              <Shield className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditingRole(row)}
              title="Edit role"
              className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-secondary-700 transition-colors">
              <Edit className="w-3.5 h-3.5" />
            </button>
            {row.is_active && (
              <button onClick={() => deactivate.mutate(row.id)}
                title="Deactivate"
                className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors">
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary-500">{users.length} user{users.length !== 1 ? 's' : ''} in this company</p>
        {canManage && (
          <button onClick={() => setInviting(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Invite User
          </button>
        )}
      </div>

      <Table columns={columns} data={users} loading={isLoading} emptyMessage="No users yet." />

      {inviting && <InviteModal companyId={companyId} onClose={() => setInviting(false)} />}
      {editingModules && (
        <ModuleAccessModal
          companyId={companyId}
          user={editingModules}
          onClose={() => setEditingModules(null)} />
      )}
      {editingRole && (
        <EditRoleModal
          companyId={companyId}
          user={editingRole}
          onClose={() => setEditingRole(null)} />
      )}
    </div>
  );
}

function ModuleCount({ companyId, userId }) {
  const { data: modules = [] } = useUserModules(companyId, userId);
  if (modules.length === 0) return <span className="text-xs text-secondary-400">Plan default</span>;
  return (
    <span className="text-xs text-primary-600 font-medium">{modules.length} custom</span>
  );
}

function InviteModal({ companyId, onClose }) {
  const invite = useInviteUser(companyId);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [selectedModules, setSelectedModules] = useState([]);

  function toggleModule(m) {
    setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function onSubmit(data) {
    try {
      await invite.mutateAsync({ ...data, modules: selectedModules });
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal isOpen onClose={onClose} title="Invite User" size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={invite.isPending} className="btn-primary">
            <Mail className="w-4 h-4" />
            {invite.isPending ? 'Inviting...' : 'Send Invite'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <FormField label="Full Name" error={errors.fullName?.message}>
          <Input {...register('fullName', { required: 'Required' })} placeholder="Jane Smith" />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email', { required: 'Required' })} type="email" placeholder="jane@example.com" />
        </FormField>
        <FormField label="Role">
          <Select {...register('role', { required: true })}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </FormField>

        <div className="border-t border-secondary-100 pt-4">
          <p className="text-sm font-medium text-secondary-700 mb-1">Module Access</p>
          <p className="text-xs text-secondary-400 mb-3">Leave all unchecked to use plan defaults.</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MODULES.map(m => {
              const active = selectedModules.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggleModule(m)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-colors ${
                    active ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'
                  }`}>
                  {active ? <ToggleRight className="w-3.5 h-3.5 flex-shrink-0" /> : <ToggleLeft className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span>{MODULE_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-secondary-400">
          The user will receive a confirmation email to set their password.
        </p>
      </div>
    </Modal>
  );
}

function EditRoleModal({ companyId, user, onClose }) {
  const updateUser = useUpdateUser(companyId);
  const { register, handleSubmit } = useForm({
    defaultValues: { role: user.role, is_active: user.is_active },
  });

  async function onSubmit(data) {
    try {
      await updateUser.mutateAsync({ id: user.id, ...data });
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit: ${user.full_name || user.email}`} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit(onSubmit)} disabled={updateUser.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {updateUser.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <FormField label="Role">
          <Select {...register('role')}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </FormField>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" {...register('is_active')} className="rounded" />
          Active
        </label>
      </div>
    </Modal>
  );
}

function ModuleAccessModal({ companyId, user, onClose }) {
  const { data: currentModules = [], isLoading } = useUserModules(companyId, user.user_id);
  const setModules = useSetUserModules(companyId);
  const [selected, setSelected] = useState(null);

  // Initialise once data loads
  const activeModules = selected ?? currentModules;

  function toggle(m) {
    const cur = selected ?? currentModules;
    setSelected(cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m]);
  }

  async function save() {
    try {
      await setModules.mutateAsync({ userId: user.user_id, modules: activeModules });
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Module Access: ${user.full_name || user.email}`} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={setModules.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {setModules.isPending ? 'Saving...' : 'Save Access'}
          </button>
        </div>
      }>
      <div className="space-y-3">
        <p className="text-xs text-secondary-500">
          Override which modules this user can access, regardless of their subscription plan.
          Leave all unchecked to use plan defaults.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {ALL_MODULES.map(m => {
              const active = activeModules.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggle(m)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 border-primary-300 text-primary-700'
                      : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'
                  }`}>
                  {active
                    ? <ToggleRight className="w-4 h-4 flex-shrink-0" />
                    : <ToggleLeft className="w-4 h-4 flex-shrink-0" />}
                  <span>{MODULE_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
