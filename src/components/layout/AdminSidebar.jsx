import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Crown, Shield, ShieldAlert, ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../store';

const adminNav = [
  { to: '/admin', icon: Building2, label: 'Companies' },
  { to: '/admin/plans', icon: Crown, label: 'Subscription Plans' },
];

export function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <aside className={`
      fixed top-0 left-0 h-full z-50 flex flex-col bg-secondary-900 text-white transition-all duration-300
      ${sidebarOpen ? 'w-64' : 'w-16'}
    `}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-secondary-700 min-h-[65px]">
        <div className="flex-shrink-0 w-8 h-8 bg-error-600 rounded-lg flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="font-bold text-sm text-white leading-none truncate">Humanverse360</p>
            <p className="text-xs text-error-400 mt-0.5">Platform Admin</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <div className="mb-4">
          {sidebarOpen && (
            <p className="px-4 mb-1 text-xs font-semibold text-secondary-500 uppercase tracking-wider">Admin</p>
          )}
          {adminNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) =>
                `sidebar-link mx-2 ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${!sidebarOpen ? 'justify-center' : ''}`
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate flex-1">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Back to app */}
      {sidebarOpen && (
        <div className="mx-3 mb-2">
          <NavLink to="/"
            className="sidebar-link sidebar-link-inactive">
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Back to App</span>
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
  );
}
