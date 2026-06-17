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
    <header
      className={`
        fixed top-0 right-0 z-30 h-16 flex items-center gap-4 px-4 sm:px-6
        transition-all duration-300
        ${sidebarOpen ? 'lg:left-64' : 'lg:left-16'} left-0
      `}
      style={{ background: '#1f2937', borderBottom: '1px solid rgba(212,175,55,0.15)' }}
    >
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden p-2 rounded-lg transition-colors"
        style={{ color: '#9ca3af' }}
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold truncate" style={{ color: '#f9fafb' }}>{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Subscription Badge */}
        {subscription && (
          <Link
            to="/subscription"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'rgba(212,175,55,0.12)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.25)' }}
          >
            <Crown className="w-3.5 h-3.5" />
            {subscription.name?.split(' ')[0] || 'Free'}
          </Link>
        )}

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => { setShowNotif(!showNotif); setShowUser(false); }}
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: '#9ca3af' }}
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span
                className="absolute top-1 right-1 w-4 h-4 text-white text-xs rounded-full flex items-center justify-center font-bold"
                style={{ background: '#D4AF37', color: '#111827' }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl z-50 animate-slide-up"
              style={{ background: '#1f2937', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #374151' }}>
                <span className="text-sm font-semibold" style={{ color: '#f9fafb' }}>Notifications</span>
                {unread > 0 && (
                  <span className="badge text-xs font-bold" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                    {unread} unread
                  </span>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center" style={{ color: '#6b7280' }}>No notifications</p>
                ) : (
                  notifications.slice(0, 8).map(n => (
                    <div
                      key={n.id}
                      className="px-4 py-3 transition-colors"
                      style={{ borderBottom: '1px solid #374151' }}
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.severity === 'Critical' ? 'bg-error-500' : n.severity === 'Warning' ? 'bg-warning-500' : ''}`}
                          style={!['Critical', 'Warning'].includes(n.severity) ? { background: '#D4AF37' } : {}} />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: '#f3f4f6' }}>{n.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{n.message}</p>
                          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{formatDate(n.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2.5" style={{ borderTop: '1px solid #374151' }}>
                <Link
                  to="/documents"
                  onClick={() => setShowNotif(false)}
                  className="text-xs font-semibold hover:underline"
                  style={{ color: '#D4AF37' }}
                >
                  View all alerts
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="relative">
          <button
            onClick={() => { setShowUser(!showUser); setShowNotif(false); }}
            className="flex items-center gap-2 p-1.5 rounded-lg transition-colors"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
              style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #b8952a 100%)', color: '#111827' }}
            >
              {company?.name?.slice(0, 2).toUpperCase() || 'HR'}
            </div>
          </button>
          {showUser && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl z-50 animate-slide-up"
              style={{ background: '#1f2937', border: '1px solid rgba(212,175,55,0.2)' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #374151' }}>
                <p className="text-sm font-semibold truncate" style={{ color: '#f9fafb' }}>{company?.name}</p>
                <p className="text-xs mt-0.5 capitalize" style={{ color: '#9ca3af' }}>{userRole} Account</p>
              </div>
              <Link
                to="/subscription"
                onClick={() => setShowUser(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
                style={{ color: '#D4AF37' }}
              >
                <Crown className="w-4 h-4" /> Manage Subscription
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm rounded-b-xl transition-colors"
                style={{ color: '#f87171' }}
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {(showNotif || showUser) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowNotif(false); setShowUser(false); }} />
      )}
    </header>
  );
}
