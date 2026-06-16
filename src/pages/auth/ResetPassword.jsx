import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);   // recovery session established
  const [invalid, setInvalid] = useState(false); // bad/expired link
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase parses the #access_token fragment and fires PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      } else if (event === 'SIGNED_IN' && !ready) {
        // also handle if session was set before listener registered
        setReady(true);
      }
    });

    // Check if a session is already present (e.g. page refreshed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        // Wait up to 3s for the PASSWORD_RECOVERY event; if nothing, link is invalid
        const timer = setTimeout(() => {
          setInvalid(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (e) {
      setError(e.message || 'Failed to update password. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  }

  const brandGradient = 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)';

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#F0F4F9' }}>
      <div className="w-full max-w-sm">
        <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />

        <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">

          {/* Invalid / expired link */}
          {invalid && !ready && (
            <div className="text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4 bg-red-50">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Link expired or invalid</h2>
              <p className="text-sm text-gray-500 mb-6">
                This password reset link has expired or already been used. Please request a new one.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90"
                style={{ background: brandGradient }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {/* Waiting for recovery session */}
          {!ready && !invalid && (
            <div className="text-center py-6">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-400">Verifying reset link…</p>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: '#F0FDF4' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: '#3DB83F' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Password updated!</h2>
              <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
            </div>
          )}

          {/* Reset form */}
          {ready && !done && (
            <>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: '#EFF6FF' }}>
                <KeyRound className="w-6 h-6" style={{ color: '#2563EB' }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Set new password</h2>
              <p className="text-sm text-gray-400 mb-6">Choose a strong password for your account.</p>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      required
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Strength hint */}
                {password.length > 0 && (
                  <div className="flex gap-1">
                    {[...Array(4)].map((_, i) => {
                      const strength = Math.min(4, Math.floor(password.length / 3));
                      const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
                      return (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? colors[strength - 1] : 'bg-gray-200'}`} />
                      );
                    })}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}
                >
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
