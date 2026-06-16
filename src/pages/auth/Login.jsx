import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { FormField, Input } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'forgot_sent'
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm();

  async function onSubmit({ email, password }) {
    setError('');
    try {
      await signIn(email, password);
      navigate('/');
    } catch (e) {
      setError(e.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : e.message);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    setForgotError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      // Try platform SMTP first via edge function
      const { data, error: fnErr } = await supabase.functions.invoke('send-password-reset', {
        body: { email: forgotEmail.trim(), redirectTo },
      });

      if (fnErr || data?.error === 'smtp_not_configured') {
        // Platform SMTP not configured — fall back to Supabase built-in email
        const { error: authErr } = await supabase.auth.resetPasswordForEmail(
          forgotEmail.trim(), { redirectTo }
        );
        if (authErr) throw authErr;
      } else if (data && !data.success) {
        throw new Error(data.error || 'Failed to send reset email.');
      }

      setMode('forgot_sent');
    } catch (e) {
      setForgotError(e.message || 'Failed to send reset email. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  function openForgot() {
    setForgotEmail(getValues('email') || '');
    setForgotError('');
    setMode('forgot');
  }

  const brandGradient = 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F0F4F9' }}>

      {/* ── Left branding panel ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0D2554 0%, #1B3A6E 55%, #1A5C30 100%)' }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.06]" style={{ background: '#3DB83F', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.06]" style={{ background: '#2563EB', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: '#fff', transform: 'translate(-50%,-50%)' }} />

        <div className="relative z-10 flex flex-col items-center px-12 max-w-lg text-center">
          <div className="bg-white rounded-3xl p-6 shadow-2xl mb-8 inline-block">
            <img
              src="/ChatGPT_Image_Jun_16,_2026,_01_56_49_PM.png"
              alt="HumanVerse360"
              className="w-56 h-auto"
            />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.25)' }} />
            <p className="text-xs font-semibold tracking-widest text-white/60 uppercase whitespace-nowrap">
              HR &amp; PAYROLL. SIMPLIFIED. INTELLIGENT. SECURE.
            </p>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.25)' }} />
          </div>

          <p className="text-white/70 text-base leading-relaxed mt-2">
            Empowering People. Streamlining Payroll.{' '}
            <span className="font-semibold" style={{ color: '#3DB83F' }}>Driving Success—Together.</span>
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {['Employee Management', 'Payroll Processing', 'Leave Tracking', 'Document Expiry', 'Indemnity Calculator'].map(f => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full text-xs font-medium text-white/80"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-white/30 text-center px-8">
          Powered by Innovegic Consultancy And IT Services Co W.L.L
        </p>
      </div>

      {/* ── Right form panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <img
            src="/ChatGPT_Image_Jun_16,_2026,_01_56_49_PM.png"
            alt="HumanVerse360"
            className="w-44 mx-auto"
          />
          <p className="text-xs text-gray-400 mt-2 tracking-widest uppercase">
            HR &amp; PAYROLL. SIMPLIFIED. INTELLIGENT. SECURE.
          </p>
        </div>

        <div className="w-full max-w-sm">
          {/* Top accent bar */}
          <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />

          {/* ── Sign In ── */}
          {mode === 'login' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Welcome back</h2>
              <p className="text-sm text-gray-400 mb-7">Sign in to your company account</p>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField label="Work Email" error={errors.email?.message}>
                  <Input
                    {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                    type="email" placeholder="admin@company.com" autoComplete="email"
                    error={errors.email}
                  />
                </FormField>

                <div>
                  <FormField label="Password" error={errors.password?.message}>
                    <div className="relative">
                      <Input
                        {...register('password', { required: 'Password is required' })}
                        type={showPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        error={errors.password}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormField>
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={openForgot}
                      className="text-xs font-medium hover:underline transition-colors"
                      style={{ color: '#2563EB' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}
                >
                  {isSubmitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  New to HumanVerse360?{' '}
                  <Link to="/register" className="font-semibold hover:underline" style={{ color: '#3DB83F' }}>
                    Register your company
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* ── Forgot Password Form ── */}
          {mode === 'forgot' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>

              <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: '#EFF6FF' }}>
                <Mail className="w-6 h-6" style={{ color: '#2563EB' }} />
              </div>

              <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Reset your password</h2>
              <p className="text-sm text-gray-400 mb-6">
                Enter your work email and we'll send you a link to reset your password.
              </p>

              {forgotError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Email</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:border-transparent transition"
                    style={{ '--tw-ring-color': '#2563EB' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}
                >
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </div>
          )}

          {/* ── Email Sent Confirmation ── */}
          {mode === 'forgot_sent' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: '#F0FDF4' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: '#3DB83F' }} />
              </div>

              <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-1">We've sent a password reset link to</p>
              <p className="text-sm font-semibold mb-6" style={{ color: '#1B3A6E' }}>{forgotEmail}</p>
              <p className="text-xs text-gray-400 mb-6">
                Click the link in the email to set a new password. The link expires in 1 hour.
                If you don't see it, check your spam folder.
              </p>

              <button
                type="button"
                onClick={() => { setMode('login'); setForgotEmail(''); }}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ background: brandGradient }}
              >
                Back to Sign In
              </button>

              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Try a different email
              </button>
            </div>
          )}

          <p className="lg:hidden text-center text-xs text-gray-400 mt-5">
            Powered by Innovegic Consultancy And IT Services Co W.L.L
          </p>
        </div>
      </div>
    </div>
  );
}
