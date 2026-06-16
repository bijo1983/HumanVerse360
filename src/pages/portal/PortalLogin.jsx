import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function PortalLogin() {
  const { signIn, company, slug } = usePortalAuth();
  const [empCode, setEmpCode]   = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(empCode.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Company branding */}
        <div className="text-center mb-8">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="h-16 w-auto mx-auto mb-3 rounded-lg object-contain" />
          ) : (
            <div className="w-16 h-16 bg-primary-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{company?.name?.[0] ?? 'P'}</span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-secondary-900">{company?.name ?? 'Employee Portal'}</h1>
          <p className="text-sm text-secondary-500 mt-1">Employee Self-Service Portal</p>
        </div>

        <div className="card p-8">
          <h2 className="text-lg font-semibold text-secondary-800 mb-6">Sign In</h2>
          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Employee ID</label>
              <input
                type="text"
                value={empCode}
                onChange={e => setEmpCode(e.target.value)}
                placeholder="e.g. EMP001"
                required
                className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full px-3 py-2.5 pr-10 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>
          <p className="text-center text-sm text-secondary-500 mt-4">
            First time?{' '}
            <Link to={`/portal/${slug}/register`} className="text-primary-600 hover:text-primary-700 font-medium">
              Create your account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
