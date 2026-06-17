import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/layout/Layout';
import { AdminLayout } from './components/layout/AdminLayout';
import SubscriptionGuard from './components/SubscriptionGuard';
import Dashboard from './pages/Dashboard';
import EmployeeList from './pages/employees/EmployeeList';
import EmployeeDetail from './pages/employees/EmployeeDetail';
import LeaveManagement from './pages/leave/LeaveManagement';
import DocumentsPage from './pages/documents/DocumentsPage';
import PayrollPage from './pages/payroll/PayrollPage';
import IndemnityPage from './pages/indemnity/IndemnityPage';
import CalculationSettings from './pages/settings/CalculationSettings';
import GeneralSettings from './pages/settings/GeneralSettings';
import ESSPage from './pages/ess/ESSPage';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import AcceptInvite from './pages/auth/AcceptInvite';
import SubscriptionPage from './pages/subscription/SubscriptionPage';
import AdminPage from './pages/admin/AdminPage';
import PortalApp from './pages/portal/PortalApp';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function ProtectedRoute({ children }) {
  const { user, company, loading, isAdmin } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-secondary-400">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  if (!company) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, company, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  if (user && company) return <Navigate to="/" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Employee portal — standalone, uses separate auth client */}
      <Route path="/portal/:slug/*" element={<PortalApp />} />

      <Route path="/accept-invite/:token" element={<AcceptInvite />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminPage />} />
      </Route>
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<SubscriptionGuard module="employees"><EmployeeList /></SubscriptionGuard>} />
        <Route path="employees/:id" element={<SubscriptionGuard module="employees"><EmployeeDetail /></SubscriptionGuard>} />
        <Route path="leave" element={<SubscriptionGuard module="leave"><LeaveManagement /></SubscriptionGuard>} />
        <Route path="documents" element={<SubscriptionGuard module="documents"><DocumentsPage /></SubscriptionGuard>} />
        <Route path="payroll" element={<SubscriptionGuard module="payroll"><PayrollPage /></SubscriptionGuard>} />
        <Route path="indemnity" element={<SubscriptionGuard module="indemnity"><IndemnityPage /></SubscriptionGuard>} />
        <Route path="settings/calculations" element={<SubscriptionGuard module="settings"><CalculationSettings /></SubscriptionGuard>} />
        <Route path="settings/general" element={<SubscriptionGuard module="settings"><GeneralSettings /></SubscriptionGuard>} />
        <Route path="ess" element={<SubscriptionGuard module="ess"><ESSPage /></SubscriptionGuard>} />
        <Route path="subscription" element={<SubscriptionPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
