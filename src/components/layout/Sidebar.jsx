import { NavLink } from 'react-router-dom';
import { useAppStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, Users, Calendar, FileText, DollarSign, Calculator,
  Settings, ChevronLeft, Building2, Shield, Smartphone, Crown, Lock, ShieldAlert
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
    ],
  },
  {
    label: 'Self Service',
    items: [
      { to: '/ess', icon: Smartphone, label: 'Employee ESS', module: 'ess' },
    ],
  },
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, mobileSidebarOpen, setMobileSidebarOpen } = useAppStore();
  const { company, subscription, hasModuleAccess, isAdmin } = useAuth();

  return (
    <>
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-16'}
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: '#111827', borderRight: '1px solid #1f2937' }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-4 py-4 min-h-[65px]"
          style={{ borderBottom: '1px solid rgba(212,175,55,0.15)' }}
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #b8952a 100%)' }}
          >
            {company?.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="w-full h-full object-contain" />
            ) : (
              <Shield className="w-5 h-5 text-secondary-900" />
            )}
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="font-bold text-sm leading-none truncate" style={{ color: '#f9fafb' }}>
                {company?.name || 'HumanVerse360'}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <Crown className="w-3 h-3" style={{ color: '#D4AF37' }} />
                <span className="text-xs font-semibold" style={{ color: '#D4AF37' }}>
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
                <p className="px-4 mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#4b5563' }}>
                  {group.label}
                </p>
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
                      `sidebar-link mx-2 relative ${isActive && !locked ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${!sidebarOpen ? 'justify-center' : ''} ${locked ? 'opacity-50' : ''}`
                    }
                    title={!sidebarOpen ? item.label : undefined}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {sidebarOpen && <span className="truncate flex-1">{item.label}</span>}
                    {sidebarOpen && locked && <Lock className="w-3 h-3 flex-shrink-0" style={{ color: '#4b5563' }} />}
                    {!sidebarOpen && locked && (
                      <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full" style={{ background: '#D4AF37' }} />
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
            <NavLink
              to="/subscription"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
              }
            >
              <Crown className="w-4 h-4 flex-shrink-0" style={{ color: '#D4AF37' }} />
              <span className="truncate" style={{ color: isActive => isActive ? undefined : '#D4AF37' }}>Subscription</span>
            </NavLink>
          </div>
        )}

        {/* Admin Link */}
        {isAdmin && (
          <div className="mx-3 mb-2">
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              style={({ isActive }) => isActive ? {} : { color: '#f87171' }}
              title={!sidebarOpen ? 'Platform Admin' : undefined}
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">Platform Admin</span>}
            </NavLink>
          </div>
        )}

        {/* Collapse */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(212,175,55,0.15)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent'; }}
          >
            <ChevronLeft className={`w-4 h-4 flex-shrink-0 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
            {sidebarOpen && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
