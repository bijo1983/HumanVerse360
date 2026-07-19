import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, FileText, DollarSign, Calculator,
  Settings, ChevronLeft, Building2, Shield, Smartphone, Crown, Lock, ShieldAlert, Percent, Globe2
} from 'lucide-react';

const navGroups = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', module: null },
      { to: '/employees', icon: Users, label: 'Employees', module: 'employees' },
    ],
  },
  {
    label: 'HR',
    items: [
      { to: '/leave', icon: Calendar, label: 'Leave Management', module: 'leave' },
      { to: '/documents', icon: FileText, label: 'Documents & Expiry', module: 'documents' },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll', icon: DollarSign, label: 'Payroll', module: 'payroll' },
      { to: '/indemnity', icon: Calculator, label: 'Indemnity & Settlement', module: 'indemnity' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/settings/calculations', icon: Settings, label: 'Calculation Settings', module: 'settings' },
      { to: '/settings/general', icon: Building2, label: 'Organization', module: 'settings' },
      { to: '/settings/payroll', icon: Percent, label: 'Payroll Settings', module: 'settings' },
      { to: '/settings/country-setup', icon: Globe2, label: 'Country Setup', module: 'settings' },
    ],
  },
  {
    label: 'Self Service',
    items: [
      { to: '/ess', icon: Smartphone, label: 'Employee ESS', module: 'ess' },
    ],
  },
];

const PLAN_COLORS = {
  free: 'bg-secondary-700 text-secondary-300',
  small: 'bg-blue-900 text-blue-300',
  medium: 'bg-primary-800 text-primary-200',
  large: 'bg-accent-900 text-accent-300',
};

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const { company, subscription, hasModuleAccess, isAdmin } = useAuth();

  const planCode = subscription?.code || 'free';

  return (
    <>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col bg-secondary-900 text-white transition-all duration-300
        ${sidebarOpen ? 'w-64' : 'w-16'}
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-secondary-700 min-h-[65px]">
          <div className="flex-shrink-0 w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center overflow-hidden">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
            ) : (
              <Shield className="w-5 h-5 text-white" />
            )}
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="font-bold text-sm text-white leading-none truncate">{company?.name || 'Humanverse360'}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Crown className="w-3 h-3 text-secondary-400" />
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PLAN_COLORS[planCode]}`}>
                  {subscription?.name?.split(' ')[0] || 'Free'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {navGroups.map(group => (
            <div key={group.label} className="mb-4">
              {sidebarOpen && (
                <p className="px-4 mb-1 text-xs font-semibold text-secondary-500 uppercase tracking-wider">{group.label}</p>
              )}
              {group.items.map(item => {
                const locked = item.module && !hasModuleAccess(item.module);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link mx-2 relative ${isActive && !locked ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${!sidebarOpen ? 'justify-center' : ''} ${locked ? 'opacity-60' : ''}`
                    }
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span className="truncate flex-1">{item.label}</span>}
                    {sidebarOpen && locked && <Lock className="w-3 h-3 text-secondary-500 flex-shrink-0" />}
                    {!sidebarOpen && locked && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-warning-400 rounded-full" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Subscription Link */}
        {sidebarOpen && (
          <div className="mx-3 mb-2">
            <NavLink to="/subscription"
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'bg-primary-900/40 text-primary-300 hover:bg-primary-900 hover:text-primary-100'}`}>
              <Crown className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Subscription</span>
            </NavLink>
          </div>
        )}

        {/* Admin Link */}
        {isAdmin && (
          <div className="mx-3 mb-2">
            <NavLink to="/admin"
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : 'bg-error-900/40 text-error-300 hover:bg-error-900/60 hover:text-error-100'}`}
              title={!sidebarOpen ? 'Platform Admin' : undefined}>
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">Platform Admin</span>}
            </NavLink>
          </div>
        )}

        {/* Collapse */}
        <div className="p-3 border-t border-secondary-700">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-secondary-400 hover:text-white hover:bg-secondary-700 transition-all text-sm">
            <ChevronLeft className={`w-4 h-4 flex-shrink-0 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
