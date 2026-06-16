import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Calendar, DollarSign, AlertTriangle } from 'lucide-react';
import { useEmployee } from '../../hooks/useEmployees';
import { useLeaveBalances } from '../../hooks/useLeave';
import { useDocuments } from '../../hooks/useDocuments';
import { useAuth } from '../../contexts/AuthContext';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { formatDate, formatCurrency, getDaysUntilExpiry, getDocumentStatus } from '../../lib/calculations';
import { differenceInYears, parseISO } from 'date-fns';
import { useState } from 'react';
import EmployeeForm from './EmployeeForm';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { companyId } = useAuth();
  const [showEdit, setShowEdit] = useState(false);
  const { data: emp, isLoading } = useEmployee(id);
  const { data: balances = [] } = useLeaveBalances(id, new Date().getFullYear(), companyId);
  const { data: documents = [] } = useDocuments({ employee_id: id }, companyId);

  if (isLoading) return <div className="card p-8 text-center text-secondary-400">Loading...</div>;
  if (!emp) return <div className="card p-8 text-center text-secondary-400">Employee not found</div>;

  const yearsOfService = emp.joining_date
    ? differenceInYears(new Date(), parseISO(emp.joining_date))
    : 0;

  const gross = (emp.basic_salary || 0) + (emp.housing_allowance || 0) +
    (emp.transport_allowance || 0) + (emp.food_allowance || 0) + (emp.other_allowances || 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/employees" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-secondary-900">{emp.first_name} {emp.last_name}</h2>
          <p className="text-sm text-secondary-400">{emp.employee_id} · {emp.department_name}</p>
        </div>
        <StatusBadge status={emp.status} />
        <button onClick={() => setShowEdit(true)} className="btn-secondary"><Edit className="w-4 h-4" /> Edit</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profile Card */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex flex-col items-center text-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mb-3">
              <span className="text-xl font-bold text-primary-700">{emp.first_name[0]}{emp.last_name[0]}</span>
            </div>
            <h3 className="font-semibold text-secondary-900">{emp.first_name} {emp.last_name}</h3>
            {emp.arabic_name && <p className="text-sm text-secondary-500 font-arabic" dir="rtl">{emp.arabic_name}</p>}
            <p className="text-sm text-secondary-500">{emp.position_title || '–'}</p>
          </div>
          <div className="space-y-2 text-sm">
            {[
              ['Employee ID', emp.employee_id],
              ['Nationality', emp.nationality],
              ['Gender', emp.gender],
              ['Marital Status', emp.marital_status],
              ['Work Email', emp.work_email],
              ['Mobile', emp.mobile],
              ['Joining Date', formatDate(emp.joining_date)],
              ['Service Years', `${yearsOfService} year${yearsOfService !== 1 ? 's' : ''}`],
            ].map(([k, v]) => v ? (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-secondary-400 text-xs">{k}</span>
                <span className="font-medium text-secondary-700 text-xs text-right">{v}</span>
              </div>
            ) : null)}
          </div>
        </div>

        {/* Right Side */}
        <div className="lg:col-span-2 space-y-4">
          {/* Salary */}
          <div className="card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-accent-500" /> Salary Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['Basic Salary', emp.basic_salary],
                ['Housing Allowance', emp.housing_allowance],
                ['Transport Allowance', emp.transport_allowance],
                ['Food Allowance', emp.food_allowance],
                ['Other Allowances', emp.other_allowances],
              ].map(([k, v]) => (
                <div key={k} className="bg-secondary-50 p-3 rounded-lg">
                  <p className="text-xs text-secondary-400">{k}</p>
                  <p className="text-sm font-semibold text-secondary-800 mt-0.5">{formatCurrency(v || 0)}</p>
                </div>
              ))}
              <div className="bg-primary-50 p-3 rounded-lg border border-primary-100">
                <p className="text-xs text-primary-600 font-semibold">Gross Salary</p>
                <p className="text-sm font-bold text-primary-800 mt-0.5">{formatCurrency(gross)}</p>
              </div>
            </div>
          </div>

          {/* Leave Balances */}
          <div className="card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2"><Calendar className="w-4 h-4 text-primary-500" /> Leave Balances ({new Date().getFullYear()})</h3>
            {balances.length === 0 ? (
              <p className="text-sm text-secondary-400">No leave balances initialized for this year.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {balances.map(b => {
                  const used = b.used_days + b.pending_days;
                  const pct = b.entitled_days > 0 ? Math.min(100, (used / b.entitled_days) * 100) : 0;
                  return (
                    <div key={b.id} className="bg-secondary-50 p-3 rounded-lg">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: b.leave_types?.color }} />
                        <p className="text-xs font-semibold text-secondary-700">{b.leave_types?.name}</p>
                      </div>
                      <p className="text-lg font-bold text-secondary-900">{b.entitled_days - used}<span className="text-xs text-secondary-400 font-normal"> / {b.entitled_days}d</span></p>
                      <div className="mt-1.5 h-1.5 bg-secondary-200 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="card p-5">
            <h3 className="section-title mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-warning-500" /> Documents</h3>
            {documents.length === 0 ? (
              <p className="text-sm text-secondary-400">No documents added yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map(doc => {
                  const days = getDaysUntilExpiry(doc.expiry_date);
                  const status = getDocumentStatus(doc.expiry_date);
                  return (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b border-secondary-100 last:border-0 text-sm">
                      <div>
                        <p className="font-medium text-secondary-800">{doc.document_type} {doc.document_number ? `· ${doc.document_number}` : ''}</p>
                        <p className="text-xs text-secondary-400">{doc.expiry_date ? `Expires: ${formatDate(doc.expiry_date)}` : 'No expiry'}</p>
                      </div>
                      <Badge variant={status === 'valid' ? 'valid' : status === 'expired' ? 'expired' : status === 'critical' ? 'critical' : 'alert'}>
                        {days !== null ? (days < 0 ? 'Expired' : `${days}d`) : 'Valid'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && <EmployeeForm employee={emp} onClose={() => setShowEdit(false)} />}
    </div>
  );
}
