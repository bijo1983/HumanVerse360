import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Users, UserPlus, Edit, Shield, UserCheck, Save, Mail, Copy, Check,
  ChevronDown, Search, DollarSign, EyeOff, Eye, Clock, XCircle,
  ToggleLeft, ToggleRight, Info,
} from 'lucide-react';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { FormField, Select } from '../../components/ui/Form';
import { MODULE_LABELS } from '../../lib/plans';

// ── Role definitions ──────────────────────────────────────────────────────────

const ROLES = {
  admin: {
    label: 'Admin',
    description: 'Company owner. Full access to all features, users, billing, and salary data.',
    color: 'bg-error-50 text-error-700 border-error-200',
    defaultSalary: true,
    invitable: false,
  },
  it_admin: {
    label: 'IT Admin',
    description: 'Manages system users, module settings, and data integrations. No salary access by default.',
    color: 'bg-primary-50 text-primary-700 border-primary-200',
    defaultSalary: false,
    invitable: true,
  },
  manager: {
    label: 'Manager',
    description: 'Approves leave, views employee data and reports. No salary access by default.',
    color: 'bg-warning-50 text-warning-700 border-warning-200',
    defaultSalary: false,
    invitable: true,
  },
  hr: {
    label: 'HR',
    description: 'Manages employee records, payroll, and leave processing. Salary access enabled by default.',
    color: 'bg-success-50 text-success-700 border-success-200',
    defaultSalary: true,
    invitable: true,
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to assigned modules. No salary access.',
    color: 'bg-secondary-100 text-secondary-600 border-secondary-200',
    defaultSalary: false,
    invitable: true,
  },
};

const INVITABLE_ROLES = Object.entries(ROLES)
  .filter(([, r]) => r.invitable)
  .map(([v, r]) => ({ value: v, ...r }));

const ALL_MODULES = Object.keys(MODULE_LABELS);

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

function useInvitations(companyId) {
  return useQuery({
    queryKey: ['user-invitations', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

function useEmployeesForInvite(companyId) {
  return useQuery({
    queryKey: ['employees-for-invite', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: employees, error } = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name, work_email, personal_email')
        .eq('company_id', companyId)
        .order('first_name');
      if (error) throw error;

      const { data: invitations } = await supabase
        .from('user_invitations')
        .select('email')
        .eq('company_id', companyId)
        .eq('status', 'pending');

      const { data: users } = await supabase
        .from('company_users')
        .select('email')
        .eq('company_id', companyId);

      const usedEmails = new Set([
        ...(invitations || []).map(i => i.email),
        ...(users || []).map(u => u.email),
      ]);

      return (employees || []).filter(
        e => !(e.work_email && usedEmails.has(e.work_email)) &&
             !(e.personal_email && usedEmails.has(e.personal_email))
      );
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
      await supabase.from('company_user_modules').delete()
        .eq('company_id', companyId).eq('user_id', userId);
      if (modules.length > 0) {
        await supabase.from('company_user_modules').insert(
          modules.map(m => ({ company_id: companyId, user_id: userId, module: m }))
        );
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['user-modules', companyId, vars.userId] });
    },
  });
}

function useCreateInvitation(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, email, fullName, role, showSalary, modules }) => {
      const { data, error } = await supabase
        .from('user_invitations')
        .insert({
          company_id: companyId,
          employee_id: employeeId || null,
          email,
          full_name: fullName,
          role,
          show_salary: showSalary,
          module_overrides: modules.length > 0 ? modules : null,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select('token')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-invitations', companyId] });
      qc.invalidateQueries({ queryKey: ['employees-for-invite', companyId] });
    },
  });
}

function useRevokeInvitation(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-invitations', companyId] }),
  });
}

function useUpdateUser(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role, is_active, show_salary }) => {
      const { error } = await supabase.from('company_users')
        .update({ role, is_active, show_salary }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users', companyId] }),
  });
}

function useDeactivateUser(companyId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('company_users')
        .update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users', companyId] }),
  });
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { companyId, user: currentUser, userRole } = useAuth();
  const { data: users = [], isLoading } = useCompanyUsers(companyId);
  const { data: invitations = [] } = useInvitations(companyId);
  const [activeTab, setActiveTab] = useState('users');
  const [inviting, setInviting] = useState(false);
  const [editingModules, setEditingModules] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [inviteToken, setInviteToken] = useState(null);
  const deactivate = useDeactivateUser(companyId);
  const revokeInv = useRevokeInvitation(companyId);

  const canManage = userRole === 'admin' || userRole === 'it_admin';

  const userColumns = [
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
      render: (v) => {
        const role = ROLES[v];
        return (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${role?.color || ROLES.viewer.color}`}>
            {role?.label || v}
          </span>
        );
      },
    },
    {
      header: 'Salary Access', key: 'show_salary',
      render: (v) => (
        <span className={`flex items-center gap-1 text-xs font-medium ${v ? 'text-success-600' : 'text-secondary-400'}`}>
          {v ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {v ? 'Visible' : 'Hidden'}
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
            <button onClick={() => setEditingModules(row)} title="Manage modules"
              className="p-1.5 hover:bg-primary-50 rounded text-secondary-400 hover:text-primary-600 transition-colors">
              <Shield className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditingUser(row)} title="Edit role & access"
              className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-secondary-700 transition-colors">
              <Edit className="w-3.5 h-3.5" />
            </button>
            {row.is_active && (
              <button onClick={() => deactivate.mutate(row.id)} title="Deactivate"
                className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors">
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  const inviteColumns = [
    {
      header: 'Invitee', key: 'full_name',
      render: (v, row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center text-secondary-500 font-semibold text-sm flex-shrink-0">
            {(v || row.email || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-secondary-800 text-sm">{v}</p>
            <p className="text-xs text-secondary-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Role', key: 'role',
      render: (v) => {
        const role = ROLES[v];
        return (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${role?.color || ROLES.viewer.color}`}>
            {role?.label || v}
          </span>
        );
      },
    },
    {
      header: 'Salary Access', key: 'show_salary',
      render: (v) => (
        <span className={`flex items-center gap-1 text-xs font-medium ${v ? 'text-success-600' : 'text-secondary-400'}`}>
          {v ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {v ? 'Visible' : 'Hidden'}
        </span>
      ),
    },
    {
      header: 'Expires', key: 'expires_at',
      render: (v) => {
        const d = new Date(v);
        const now = new Date();
        const diffDays = Math.ceil((d - now) / 86400000);
        const expired = diffDays < 0;
        return (
          <span className={`flex items-center gap-1 text-xs ${expired ? 'text-error-600' : 'text-secondary-500'}`}>
            <Clock className="w-3.5 h-3.5" />
            {expired ? 'Expired' : `${diffDays}d left`}
          </span>
        );
      },
    },
    {
      header: '', key: 'id',
      render: (id, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => setInviteToken(row.token)}
            title="Copy invite link"
            className="p-1.5 hover:bg-primary-50 rounded text-secondary-400 hover:text-primary-600 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {canManage && (
            <button
              onClick={() => revokeInv.mutate(id)}
              title="Revoke invitation"
              className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600 transition-colors">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-secondary-500">
          <span>{users.length} user{users.length !== 1 ? 's' : ''}</span>
          {invitations.length > 0 && (
            <span className="text-warning-600 font-medium">{invitations.length} pending invite{invitations.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {canManage && (
          <button onClick={() => setInviting(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Invite User
          </button>
        )}
      </div>

      {/* Role reference card */}
      <div className="bg-secondary-50 rounded-xl border border-secondary-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-secondary-400" />
          <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wide">Role Permissions</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(ROLES).map(([key, role]) => (
            <div key={key} className="bg-white rounded-lg border border-secondary-200 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${role.color}`}>{role.label}</span>
                {role.defaultSalary && <Eye className="w-3 h-3 text-success-500" title="Salary visible by default" />}
              </div>
              <p className="text-xs text-secondary-500 leading-relaxed">{role.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-secondary-200">
        {[
          { key: 'users', label: `Users (${users.length})`, icon: Users },
          { key: 'invitations', label: `Pending (${invitations.length})`, icon: Mail },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-secondary-500 hover:text-secondary-700'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <Table columns={userColumns} data={users} loading={isLoading} emptyMessage="No users yet." />
      )}
      {activeTab === 'invitations' && (
        <Table columns={inviteColumns} data={invitations} loading={false}
          emptyMessage="No pending invitations." />
      )}

      {inviting && (
        <InviteModal
          companyId={companyId}
          onClose={() => setInviting(false)}
          onCreated={(token) => { setInviting(false); setInviteToken(token); }}
        />
      )}
      {editingModules && (
        <ModuleAccessModal companyId={companyId} user={editingModules} onClose={() => setEditingModules(null)} />
      )}
      {editingUser && (
        <EditUserModal companyId={companyId} user={editingUser} onClose={() => setEditingUser(null)} />
      )}
      {inviteToken && (
        <InviteLinkModal token={inviteToken} onClose={() => setInviteToken(null)} />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModuleCount({ companyId, userId }) {
  const { data: modules = [] } = useUserModules(companyId, userId);
  if (modules.length === 0) return <span className="text-xs text-secondary-400">Plan default</span>;
  return <span className="text-xs text-primary-600 font-medium">{modules.length} custom</span>;
}

function RoleDescription({ role }) {
  if (!role || !ROLES[role]) return null;
  return (
    <p className="text-xs text-secondary-500 mt-1 p-2 bg-secondary-50 rounded-lg leading-relaxed">
      {ROLES[role].description}
    </p>
  );
}

function SalaryToggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${
        value
          ? 'bg-success-50 border-success-300 text-success-700'
          : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'
      }`}>
      {value
        ? <><Eye className="w-4 h-4 flex-shrink-0" /> Salary data visible</>
        : <><EyeOff className="w-4 h-4 flex-shrink-0" /> Salary data hidden</>}
    </button>
  );
}

function InviteModal({ companyId, onClose, onCreated }) {
  const { data: employees = [], isLoading: empLoading } = useEmployeesForInvite(companyId);
  const createInvite = useCreateInvitation(companyId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [emailSource, setEmailSource] = useState('work'); // 'work' | 'personal'
  const [role, setRole] = useState('viewer');
  const [showSalary, setShowSalary] = useState(false);
  const [selectedModules, setSelectedModules] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.employee_id || '').toLowerCase().includes(q) ||
      (e.work_email || '').toLowerCase().includes(q)
    );
  }, [employees, search]);

  function selectEmployee(emp) {
    setSelected(emp);
    setOpen(false);
    setSearch('');
    const hasWork = !!emp.work_email;
    setEmailSource(hasWork ? 'work' : 'personal');
    setShowSalary(ROLES[role]?.defaultSalary ?? false);
  }

  function handleRoleChange(r) {
    setRole(r);
    setShowSalary(ROLES[r]?.defaultSalary ?? false);
  }

  function toggleModule(m) {
    setSelectedModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  async function handleSubmit() {
    if (!selected) { setError('Please select an employee to invite.'); return; }
    const email = emailSource === 'work' ? selected.work_email : selected.personal_email;
    if (!email) { setError('Selected employee has no email address.'); return; }
    setError('');
    try {
      const inv = await createInvite.mutateAsync({
        employeeId: selected.id,
        email,
        fullName: `${selected.first_name} ${selected.last_name}`,
        role,
        showSalary,
        modules: selectedModules,
      });
      onCreated(inv.token);
    } catch (e) {
      setError(e.message);
    }
  }

  const currentEmail = selected
    ? (emailSource === 'work' ? selected.work_email : selected.personal_email)
    : null;

  return (
    <Modal isOpen onClose={onClose} title="Invite Employee as System User" size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={createInvite.isPending || !selected} className="btn-primary">
            <Mail className="w-4 h-4" />
            {createInvite.isPending ? 'Creating...' : 'Generate Invite Link'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        {error && (
          <div className="bg-error-50 border border-error-200 text-error-700 text-sm rounded-lg p-3">{error}</div>
        )}

        {/* Employee picker */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Select Employee</label>
          <div className="relative">
            <button type="button" onClick={() => setOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-secondary-300 rounded-lg text-sm bg-white hover:border-secondary-400 transition-colors">
              {selected ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                    {selected.first_name[0]}
                  </div>
                  <span className="font-medium text-secondary-800">{selected.first_name} {selected.last_name}</span>
                  <span className="text-secondary-400 text-xs">({selected.employee_id})</span>
                </div>
              ) : (
                <span className="text-secondary-400">Choose an employee...</span>
              )}
              <ChevronDown className={`w-4 h-4 text-secondary-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-secondary-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-secondary-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
                    <input
                      autoFocus
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm border border-secondary-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="overflow-y-auto">
                  {empLoading ? (
                    <div className="p-4 text-center text-sm text-secondary-400">Loading...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-4 text-center text-sm text-secondary-400">
                      {search ? 'No results found.' : 'All employees are already invited or have accounts.'}
                    </div>
                  ) : (
                    filtered.map(emp => (
                      <button key={emp.id} type="button" onClick={() => selectEmployee(emp)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary-50 transition-colors text-left">
                        <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                          {emp.first_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-secondary-800">{emp.first_name} {emp.last_name}</p>
                          <p className="text-xs text-secondary-400">{emp.employee_id} · {emp.work_email || emp.personal_email || 'No email'}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email selection */}
        {selected && (selected.work_email || selected.personal_email) && (
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-1">Send Invite To</label>
            <div className="flex gap-2">
              {selected.work_email && (
                <button type="button" onClick={() => setEmailSource('work')}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs text-left transition-colors ${emailSource === 'work' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'}`}>
                  <p className="font-medium">Work Email</p>
                  <p className="truncate">{selected.work_email}</p>
                </button>
              )}
              {selected.personal_email && (
                <button type="button" onClick={() => setEmailSource('personal')}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs text-left transition-colors ${emailSource === 'personal' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'}`}>
                  <p className="font-medium">Personal Email</p>
                  <p className="truncate">{selected.personal_email}</p>
                </button>
              )}
            </div>
            {currentEmail && <p className="text-xs text-secondary-400 mt-1">Invite link will be for: {currentEmail}</p>}
          </div>
        )}

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">Role</label>
          <div className="grid grid-cols-1 gap-1.5">
            {INVITABLE_ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => handleRoleChange(r.value)}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${role === r.value ? 'bg-primary-50 border-primary-300' : 'bg-white border-secondary-200 hover:border-secondary-300'}`}>
                <span className={`mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${r.color}`}>{r.label}</span>
                <p className="text-xs text-secondary-500 leading-relaxed">{r.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Salary visibility */}
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">
            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Salary Data Access</span>
          </label>
          <SalaryToggle value={showSalary} onChange={setShowSalary} />
        </div>

        {/* Module access */}
        <div className="border-t border-secondary-100 pt-4">
          <p className="text-sm font-medium text-secondary-700 mb-0.5">Module Access Override</p>
          <p className="text-xs text-secondary-400 mb-3">Leave all unchecked to use plan defaults.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ALL_MODULES.map(m => {
              const active = selectedModules.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggleModule(m)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-xs transition-colors ${active ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'}`}>
                  {active ? <ToggleRight className="w-3.5 h-3.5 flex-shrink-0" /> : <ToggleLeft className="w-3.5 h-3.5 flex-shrink-0" />}
                  {MODULE_LABELS[m]}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InviteLinkModal({ token, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/accept-invite/${token}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <Modal isOpen onClose={onClose} title="Invitation Created" size="md"
      footer={<div className="flex justify-end"><button onClick={onClose} className="btn-primary">Done</button></div>}>
      <div className="space-y-4">
        <div className="flex items-center justify-center w-12 h-12 bg-success-50 rounded-xl mx-auto">
          <Mail className="w-6 h-6 text-success-600" />
        </div>
        <p className="text-sm text-secondary-600 text-center">
          Share this link with the employee. It expires in <strong>7 days</strong> and can only be used once.
        </p>
        <div className="bg-secondary-50 rounded-lg border border-secondary-200 p-3">
          <p className="text-xs font-mono text-secondary-700 break-all leading-relaxed">{link}</p>
        </div>
        <button onClick={copyLink}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm transition-colors ${copied ? 'bg-success-50 border-success-300 text-success-700' : 'bg-white border-secondary-300 text-secondary-700 hover:bg-secondary-50'}`}>
          {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Invite Link</>}
        </button>
        <p className="text-xs text-secondary-400 text-center">
          You can also find this link in the Pending Invitations tab to copy again later.
        </p>
      </div>
    </Modal>
  );
}

function EditUserModal({ companyId, user, onClose }) {
  const updateUser = useUpdateUser(companyId);
  const [role, setRole] = useState(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [showSalary, setShowSalary] = useState(user.show_salary);

  function handleRoleChange(r) {
    setRole(r);
    setShowSalary(ROLES[r]?.defaultSalary ?? false);
  }

  async function save() {
    try {
      await updateUser.mutateAsync({ id: user.id, role, is_active: isActive, show_salary: showSalary });
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit: ${user.full_name || user.email}`} size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={updateUser.isPending} className="btn-primary">
            <Save className="w-4 h-4" />
            {updateUser.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-2">Role</label>
          <div className="grid grid-cols-1 gap-1.5">
            {INVITABLE_ROLES.map(r => (
              <button key={r.value} type="button" onClick={() => handleRoleChange(r.value)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors ${role === r.value ? 'bg-primary-50 border-primary-300' : 'bg-white border-secondary-200 hover:border-secondary-300'}`}>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${r.color}`}>{r.label}</span>
                <p className="text-xs text-secondary-500 truncate">{r.description}</p>
              </button>
            ))}
          </div>
          <RoleDescription role={role} />
        </div>
        <div>
          <label className="block text-sm font-medium text-secondary-700 mb-1">
            <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Salary Data Access</span>
          </label>
          <SalaryToggle value={showSalary} onChange={setShowSalary} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
          <span className="text-secondary-700">Account active</span>
        </label>
      </div>
    </Modal>
  );
}

function ModuleAccessModal({ companyId, user, onClose }) {
  const { data: currentModules = [], isLoading } = useUserModules(companyId, user.user_id);
  const setModules = useSetUserModules(companyId);
  const [selected, setSelected] = useState(null);

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
          Override which modules this user can access. Leave all unchecked to use plan defaults.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1.5">
            {ALL_MODULES.map(m => {
              const active = activeModules.includes(m);
              return (
                <button type="button" key={m} onClick={() => toggle(m)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left text-sm transition-colors ${active ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-secondary-200 text-secondary-500 hover:border-secondary-300'}`}>
                  {active ? <ToggleRight className="w-4 h-4 flex-shrink-0" /> : <ToggleLeft className="w-4 h-4 flex-shrink-0" />}
                  {MODULE_LABELS[m]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
