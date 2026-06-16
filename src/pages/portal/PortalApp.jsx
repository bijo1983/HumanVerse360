import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PortalAuthProvider, usePortalAuth } from '../../contexts/PortalAuthContext';
import PortalLogin from './PortalLogin';
import PortalRegister from './PortalRegister';
import PortalDashboard from './PortalDashboard';
import PortalLayout from '../../components/layout/PortalLayout';

function PortalProtected({ children }) {
  const { employee, loading } = usePortalAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-secondary-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!employee) return <Navigate to="" replace />;
  return children;
}

function PortalPublic({ children }) {
  const { employee, loading } = usePortalAuth();
  if (loading) return null;
  if (employee) return <Navigate to="dashboard" replace />;
  return children;
}

function PortalRoutes() {
  const { slug } = useParams();
  return (
    <Routes>
      <Route path="/" element={<PortalPublic><PortalLogin /></PortalPublic>} />
      <Route path="register" element={<PortalPublic><PortalRegister /></PortalPublic>} />
      <Route path="dashboard" element={<PortalProtected><PortalLayout><PortalDashboard /></PortalLayout></PortalProtected>} />
      <Route path="*" element={<Navigate to={`/portal/${slug}`} replace />} />
    </Routes>
  );
}

export default function PortalApp() {
  const { slug } = useParams();
  return (
    <PortalAuthProvider slug={slug}>
      <PortalRoutes />
    </PortalAuthProvider>
  );
}
