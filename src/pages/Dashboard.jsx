import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar, AlertTriangle, DollarSign, TrendingUp, Clock, FileWarning, UserCheck } from 'lucide-react';
import { StatCard } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { formatCurrency, formatDate, getDaysUntilExpiry, getDocumentStatus } from '../lib/calculations';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function useDashboardStats(companyId) {
  return useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async () => {
      const [empRes, leaveRes, docRes, payrollRes, deptRes] = await Promise.all([
        supabase.from('employees').select('status, department_id, nationality, joining_date').eq('company_id', companyId),
        supabase.from('leave_requests').select('status, days_requested, year').eq('company_id', companyId).eq('year', new Date().getFullYear()),
        supabase.from('employee_documents').select('document_type, expiry_date').eq('company_id', companyId).not('expiry_date', 'is', null),
        supabase.from('payroll_runs').select('*').eq('company_id', companyId).order('year', { ascending: false }).order('month', { ascending: false }).limit(1),
        supabase.from('departments').select('id, name').eq('company_id', companyId),
      ]);

      const employees = empRes.data || [];
      const leaves = leaveRes.data || [];
      const docs = docRes.data || [];
      const payrolls = payrollRes.data || [];
      const deptMap = Object.fromEntries((deptRes.data || []).map(d => [d.id, d.name]));

      const active = employees.filter(e => e.status === 'Active').length;
      const expiring = docs.filter(d => {
        const s = getDocumentStatus(d.expiry_date);
        return s === 'critical' || s === 'expired' || s === 'warning';
      }).length;

      const deptCounts = employees.reduce((acc, e) => {
        const name = (e.department_id && deptMap[e.department_id]) || 'Unassigned';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {});

      const deptData = Object.entries(deptCounts).map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 12) + '…' : name, count }));

      return {
        totalEmployees: employees.length,
        activeEmployees: active,
        pendingLeaves: leaves.filter(l => l.status === 'Pending').length,
        expiringDocs: expiring,
        lastPayroll: payrolls[0],
        deptData,
        nationalityData: Object.entries(
          employees.reduce((acc, e) => { acc[e.nationality || 'Unknown'] = (acc[e.nationality || 'Unknown'] || 0) + 1; return acc; }, {})
        ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5),
        leaveStats: {
          pending: leaves.filter(l => l.status === 'Pending').length,
          approved: leaves.filter(l => l.status === 'Approved').length,
          rejected: leaves.filter(l => l.status === 'Rejected').length,
        },
      };
    },
    enabled: !!companyId,
  });
}

function useRecentActivity(companyId) {
  return useQuery({
    queryKey: ['recent-activity', companyId],
    queryFn: async () => {
      const [leaveRes, empRes] = await Promise.all([
        supabase.from('leave_requests').select('*, employees(first_name, last_name), leave_types(name, color)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('employees').select('first_name, last_name, joining_date').eq('company_id', companyId).order('created_at', { ascending: false }).limit(3),
      ]);
      return { leaves: leaveRes.data || [], newEmployees: empRes.data || [] };
    },
    enabled: !!companyId,
  });
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Dashboard() {
  const { companyId } = useAuth();
  const { data: stats, isLoading } = useDashboardStats(companyId);
  const { data: activity } = useRecentActivity(companyId);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Employees" value={isLoading ? '–' : stats?.totalEmployees} subValue={`${stats?.activeEmployees || 0} active`}
          icon={<Users className="w-5 h-5" />} color="blue" />
        <Link to="/leave" className="block">
          <StatCard label="Pending Leaves" value={isLoading ? '–' : stats?.pendingLeaves}
            subValue={stats?.pendingLeaves > 0 ? 'Click to review' : `${new Date().getFullYear()} YTD`}
            icon={<Calendar className="w-5 h-5" />} color="yellow" />
        </Link>
        <StatCard label="Document Alerts" value={isLoading ? '–' : stats?.expiringDocs}
          subValue="Expiring within 60 days"
          icon={<AlertTriangle className="w-5 h-5" />} color="red" />
        <StatCard label="Last Payroll" value={isLoading ? '–' : stats?.lastPayroll ? formatCurrency(stats.lastPayroll.total_net) : 'None'}
          subValue={stats?.lastPayroll ? `${new Date(0, stats.lastPayroll.month - 1).toLocaleString('en', { month: 'short' })} ${stats.lastPayroll.year}` : 'No runs yet'}
          icon={<DollarSign className="w-5 h-5" />} color="green" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="section-title mb-4">Employees by Department</h3>
          {stats?.deptData?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.deptData} margin={{ left: -20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No data</div>}
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">Nationality Distribution</h3>
          {stats?.nationalityData?.length ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={stats.nationalityData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value">
                    {stats.nationalityData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {stats.nationalityData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-secondary-600">{d.name}</span>
                    </div>
                    <span className="font-semibold text-secondary-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-secondary-400 text-sm">No data</div>}
        </div>
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Leave Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Recent Leave Requests</h3>
            <Link to="/leave" className="text-xs text-primary-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {activity?.leaves?.length ? activity.leaves.map(l => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-secondary-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.leave_types?.color || '#3b82f6' }} />
                  <div>
                    <p className="text-sm font-medium text-secondary-800">{l.employees?.first_name} {l.employees?.last_name}</p>
                    <p className="text-xs text-secondary-400">{l.leave_types?.name} · {l.days_requested}d</p>
                  </div>
                </div>
                <StatusBadge status={l.status} />
              </div>
            )) : <p className="text-sm text-secondary-400 text-center py-4">No recent requests</p>}
          </div>
        </div>

        {/* Document Alerts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="section-title">Document Alerts</h3>
            <Link to="/documents" className="text-xs text-primary-600 hover:underline font-medium">View all</Link>
          </div>
          <ExpiringDocsList companyId={companyId} />
        </div>
      </div>
    </div>
  );
}

function ExpiringDocsList({ companyId }) {
  const { data } = useQuery({
    queryKey: ['dashboard-expiring', companyId],
    queryFn: async () => {
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*, employees(first_name, last_name)')
        .eq('company_id', companyId)
        .lte('expiry_date', future.toISOString().split('T')[0])
        .order('expiry_date')
        .limit(6);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  if (!data?.length) return <p className="text-sm text-secondary-400 text-center py-4">No expiring documents</p>;

  return (
    <div className="space-y-2">
      {data.map(doc => {
        const days = getDaysUntilExpiry(doc.expiry_date);
        return (
          <div key={doc.id} className="flex items-center justify-between py-2 border-b border-secondary-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-secondary-800">{doc.employees?.first_name} {doc.employees?.last_name}</p>
              <p className="text-xs text-secondary-400">{doc.document_type}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              days < 0 ? 'bg-error-100 text-error-700' :
              days <= 30 ? 'bg-red-100 text-red-700' :
              'bg-warning-100 text-warning-700'
            }`}>
              {days < 0 ? `${Math.abs(days)}d expired` : `${days}d left`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
