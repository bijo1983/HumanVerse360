import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortalAuth } from '../../contexts/PortalAuthContext';
import { portalSupabase } from '../../lib/portalSupabase';
import { Eye, EyeOff, UserPlus, CheckCircle } from 'lucide-react';

export default function PortalRegister() {
  const { register, company, slug } = usePortalAuth();
  const [step, setStep]           = useState(1); // 1=lookup, 2=set password
  const [empCode, setEmpCode]     = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [validatedName, setValidatedName] = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  // Step 1: validate employee exists
  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: rpcErr } = await portalSupabase.rpc('validate_portal_employee', {
        p_employee_code: empCode.trim(),
        p_work_email:    email.trim(),
        p_slug:          slug,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.valid) throw new Error(data?.error ?? 'Validation failed');
      setValidatedName(`${data.first_name} ${data.last_name}`);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: create account
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await register(empCode.trim(), email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-500'}`}>
              {step > 1 ? <CheckCircle className="w-4 h-4" /> : '1'}
            </div>
            <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-primary-600' : 'bg-secondary-200'}`} />
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-secondary-200 text-secondary-500'}`}>
              2
            </div>
          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 text-sm rounded-lg p-3 mb-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-secondary-800 mb-1">Verify Your Identity</h2>
                <p className="text-sm text-secondary-500 mb-4">Enter your Employee ID and company work email to get started.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Employee ID</label>
                <input type="text" value={empCode} onChange={e => setEmpCode(e.target.value)}
                  placeholder="e.g. EMP001" required
                  className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Work Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your.name@company.com" required
                  className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Verify Identity'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-secondary-800 mb-1">Create Password</h2>
                <p className="text-sm text-secondary-500 mb-1">
                  Welcome, <span className="font-medium text-secondary-700">{validatedName}</span>!
                  Set a password for your portal account.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" required minLength={8}
                    className="w-full px-3 py-2.5 pr-10 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-1">Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password" required
                  className="w-full px-3 py-2.5 border border-secondary-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" /> Create Account</>}
              </button>
              <button type="button" onClick={() => { setStep(1); setError(''); }} className="w-full text-sm text-secondary-500 hover:text-secondary-700">
                Go back
              </button>
            </form>
          )}

          <p className="text-center text-sm text-secondary-500 mt-4">
            Already have an account?{' '}
            <Link to={`/portal/${slug}`} className="text-primary-600 hover:text-primary-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
