import { Bell, Menu, LogOut, Crown } from 'lucide-react';
import { useAppStore } from '../../store';
import { useNotifications } from '../../hooks/useDocuments';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../../lib/calculations';

export function Header({ title }) {
  const { sidebarOpen, setMobileSidebarOpen } = useAppStore();
  const { company, subscription, signOut, companyId, userRole } = useAuth();
  const { data: notifications = [] } = useNotifications(companyId);
  const unread = notifications.filter(n => !n.is_read).length;
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className={`
      fixed top-0 right-0 z-30 h-16 bg-white border-b border-secondary-200 flex items-center gap-4 px-4 sm:px-6
      transition-all duration-300
      ${sidebarOpen ? 'lg:left-64' : 'lg:left-16'} left-0
    `}>
      <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-secondary-100 text-secondary-500">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-secondary-900 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Subscription Badge */}
        {subscription && (
          <Link to="/subscription" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-semibold hover:bg-primary-100 transition-colors">
            <Crown className="w-3.5 h-3.5" />
            {subscription.name?.split(' ')[0] || 'Free'}
          </Link>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button onClick={() => { setShowNotif(!showNotif); setShowUser(false); }}
            className="relative p-2 rounded-lg hover:bg-secondary-100 text-secondary-500 transition-colors">
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-secondary-200 z-50 animate-slide-up">
              <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-100">
                <span className="text-sm font-semibold text-secondary-900">Notifications</span>
                {unread > 0 && <span className="badge bg-error-50 text-error-600">{unread} unread</span>}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-secondary-400 text-center">No notifications</p>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-secondary-50 hover:bg-secondary-50 ${!n.is_read ? 'bg-primary-50/50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.severity === 'Critical' ? 'bg-error-500' : n.severity === 'Warning' ? 'bg-warning-500' : 'bg-primary-500'}`} />
                        <div>
                          <p className="text-xs font-semibold text-secondary-800">{n.title}</p>
                          <p className="text-xs text-secondary-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-secondary-400 mt-1">{formatDate(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-secondary-100">
                <Link to="/documents" onClick={() => setShowNotif(false)} className="text-xs text-primary-600 hover:underline font-medium">View all alerts</Link>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="relative">
          <button onClick={() => { setShowUser(!showUser); setShowNotif(false); }}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-secondary-100 transition-colors">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {company?.name?.slice(0, 2).toUpperCase() || 'HR'}
              </span>
            </div>
          </button>
          {showUser && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-2xl border border-secondary-200 z-50 animate-slide-up">
              <div className="px-4 py-3 border-b border-secondary-100">
                <p className="text-sm font-semibold text-secondary-900 truncate">{company?.name}</p>
                <p className="text-xs text-secondary-400 mt-0.5 capitalize">{userRole} Account</p>
              </div>
              <Link to="/subscription" onClick={() => setShowUser(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-secondary-600 hover:bg-secondary-50 hover:text-secondary-800">
                <Crown className="w-4 h-4" /> Manage Subscription
              </Link>
              <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error-600 hover:bg-error-50 rounded-b-xl">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {(showNotif || showUser) && <div className="fixed inset-0 z-40" onClick={() => { setShowNotif(false); setShowUser(false); }} />}
    </header>
  );
}
