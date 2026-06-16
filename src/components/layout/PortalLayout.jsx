import { LogOut, User, Home, Calendar, FileText, CreditCard, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePortalAuth } from '../../contexts/PortalAuthContext';

const NAV_ITEMS = [
  { key: 'overview',   label: 'Dashboard',    icon: Home },
  { key: 'profile',    label: 'My Profile',   icon: User },
  { key: 'leave',      label: 'Leave',        icon: Calendar },
  { key: 'documents',  label: 'Documents',    icon: FileText },
  { key: 'payslips',   label: 'Payslips',     icon: CreditCard },
];

export default function PortalLayout({ children }) {
  const { employee, company, signOut } = usePortalAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-60 bg-white border-r border-secondary-200 flex flex-col
        transform transition-transform duration-200
        lg:relative lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Company branding */}
        <div className="p-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-9 h-9 rounded-lg object-contain border border-secondary-100" />
            ) : (
              <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-sm font-bold text-white">{company?.name?.[0] ?? 'P'}</span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary-900 truncate">{company?.name ?? 'Portal'}</p>
              <p className="text-xs text-secondary-400">Employee Portal</p>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <div className="p-4 border-b border-secondary-100">
          <div className="flex items-center gap-3">
            {employee?.profile_photo ? (
              <img src={employee.profile_photo} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-primary-700">
                  {employee?.first_name?.[0]}{employee?.last_name?.[0]}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-secondary-900 truncate">
                {employee?.first_name} {employee?.last_name}
              </p>
              <p className="text-xs text-secondary-400">{employee?.employee_id}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = window.location.hash.includes(item.key) ||
              (!window.location.hash.includes('#') && item.key === 'overview');
            return (
              <button key={item.key} onClick={() => {
                window.dispatchEvent(new CustomEvent('portal-nav', { detail: item.key }));
                setMobileOpen(false);
              }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left
                  ${active ? 'bg-primary-50 text-primary-700' : 'text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-secondary-100">
          <button onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-secondary-600 hover:bg-secondary-50 hover:text-error-600 transition-colors">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-secondary-200">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg hover:bg-secondary-100">
            <Menu className="w-5 h-5 text-secondary-600" />
          </button>
          <span className="text-sm font-semibold text-secondary-800">{company?.name ?? 'Portal'}</span>
          <button onClick={signOut} className="p-1.5 rounded-lg hover:bg-secondary-100">
            <LogOut className="w-4 h-4 text-secondary-500" />
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
