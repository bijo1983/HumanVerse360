import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Shield } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Admin',
  it_admin: 'IT Admin',
  manager: 'Manager',
  hr: 'HR',
  viewer: 'Viewer',
};

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loadingInv, setLoadingInv] = useState(true);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setLoadError('Invalid invitation link.'); setLoadingInv(false); return; }
    supabase.rpc('get_invitation_by_token', { p_token: token })
      .then(({ data, error }) => {
        if (error) { setLoadError(error.message); return; }
        if (!data) { setLoadError('Invitation not found.'); return; }
        if (data.status === 'accepted') { setLoadError('This invitation has already been used.'); return; }
        if (data.status === 'revoked') { setLoadError('This invitation has been revoked.'); return; }
        if (new Date(data.expires_at) < new Date()) { setLoadError('This invitation has expired.'); return; }
        setInvitation(data);
      })
      .catch(e => setLoadError(e.message))
      .finally(() => setLoadingInv(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setSubmitError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setSubmitError('Passwords do not match.'); return; }
    setSubmitError('');
    setSubmitting(true);

    try {
      // Sign up (creates auth user — email confirmation must be disabled)
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
      });

      const alreadyExists = /already registered|already exists/i.test(signUpError?.message || '');
      if (signUpError && !alreadyExists) throw new Error(signUpError.message);

      // Sign in to get a valid session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password,
      });
      if (signInError) throw new Error(signInError.message);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Could not establish session. Please try again.');

      // Link the user to the company via the invitation
      const { data: result, error: rpcError } = await supabase.rpc('accept_user_invitation', {
        p_token: token,
        p_user_id: user.id,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (!result?.success) throw new Error(result?.error || 'Failed to accept invitation.');

      setDone(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const brandGradient = 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)';

  if (loadingInv) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F0F4F9' }}>
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0F4F9' }}>
        <div className="w-full max-w-sm">
          <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />
          <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8 text-center">
            <div className="w-12 h-12 bg-error-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-error-600" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Invalid Invitation</h2>
            <p className="text-sm text-secondary-500 mb-6">{loadError}</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-all"
              style={{ background: brandGradient }}>
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0F4F9' }}>
        <div className="w-full max-w-sm">
          <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />
          <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8 text-center">
            <div className="w-14 h-14 bg-success-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-success-600" />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Welcome aboard!</h2>
            <p className="text-sm text-secondary-500">Your account has been created. Redirecting you now...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#F0F4F9' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/ChatGPT_Image_Jun_16,_2026,_01_56_49_PM.png" alt="HumanVerse360" className="w-36 mx-auto" />
        </div>

        <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />
        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
          {/* Invitation details */}
          <div className="bg-secondary-50 rounded-xl border border-secondary-200 p-4 mb-6">
            <p className="text-xs text-secondary-500 mb-1">You've been invited to join</p>
            <p className="font-bold text-secondary-900">{invitation.company_name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Shield className="w-3.5 h-3.5 text-secondary-400" />
              <span className="text-xs text-secondary-600">
                Role: <strong>{ROLE_LABELS[invitation.role] || invitation.role}</strong>
              </span>
            </div>
            <p className="text-xs text-secondary-500 mt-1">as <strong>{invitation.full_name}</strong> ({invitation.email})</p>
          </div>

          <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Set Your Password</h2>
          <p className="text-sm text-secondary-400 mb-6">Create a password to access your account.</p>

          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-error-50 border border-error-200 rounded-xl mb-4 text-sm text-error-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required minLength={8}
                  className="w-full px-3 py-2.5 pr-10 border border-secondary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-secondary-600 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                required
                className="w-full px-3 py-2.5 border border-secondary-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
              />
              {confirm && password !== confirm && (
                <p className="text-xs text-error-500 mt-1">Passwords do not match.</p>
              )}
            </div>
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
              style={{ background: brandGradient }}>
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : 'Create Account & Sign In'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-secondary-400 mt-5">
          Powered by Innovegic Consultancy And IT Services Co W.L.L
        </p>
      </div>
    </div>
  );
}
