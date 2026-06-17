import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle2, Mail, KeyRound, ShieldCheck } from 'lucide-react';
import { FormField, Input } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';

// ─── OTP digit input ──────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = (value + '      ').slice(0, 6).split('');

  function handleKey(i, e) {
    if (e.key === 'Backspace') {
      const next = digits.map((d, j) => j === i ? '' : d).join('').trimEnd();
      onChange(next);
      if (i > 0) inputs.current[i - 1]?.focus();
    }
  }

  function handleChange(i, e) {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    if (!ch) return;
    const next = digits.map((d, j) => j === i ? ch : d).join('').slice(0, 6);
    onChange(next.trimEnd());
    if (i < 5 && ch) inputs.current[i + 1]?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); inputs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKey(i, e)}
          className="w-11 h-13 text-center text-lg font-bold border-2 rounded-xl transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          style={{
            borderColor: d.trim() ? '#2563EB' : '#E5E7EB',
            color: '#1B3A6E',
            height: '52px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Password strength bar ────────────────────────────────────────────────────
function StrengthBar({ password }) {
  if (!password) return null;
  const strength = Math.min(4, Math.floor(password.length / 3));
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  return (
    <div className="flex gap-1 mt-1.5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < strength ? colors[strength - 1] : 'bg-gray-200'}`} />
      ))}
    </div>
  );
}

// ─── Main Login component ─────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const [showPass, setShowPass] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [mode, setMode] = useState('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [stepLoading, setStepLoading] = useState(false);
  const [stepError, setStepError] = useState('');

  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm();

  async function onSubmit({ email, password }) {
    setLoginError('');
    try {
      await signIn(email, password);
      navigate('/');
    } catch (e) {
      setLoginError(e.message === 'Invalid login credentials'
        ? 'Invalid email or password. Please try again.'
        : e.message);
    }
  }

  function openForgot() {
    setForgotEmail(getValues('email') || '');
    setOtpValue('');
    setNewPassword('');
    setConfirmPassword('');
    setStepError('');
    setMode('forgot_email');
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!forgotEmail) return;
    setStepLoading(true);
    setStepError('');
    try {
      const { data, error } = await supabase.functions.invoke('send-password-reset', {
        body: { email: forgotEmail.trim() },
      });
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === 'smtp_not_configured') {
          throw new Error('Email service is not configured. Please contact your system administrator.');
        }
        throw new Error(data?.error || 'Failed to send code. Please try again.');
      }
      setOtpValue('');
      setMode('forgot_otp');
    } catch (e) {
      setStepError(e.message);
    } finally {
      setStepLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpValue.length < 6) { setStepError('Please enter the full 6-digit code.'); return; }
    setStepLoading(true);
    setStepError('');
    try {
      setNewPassword('');
      setConfirmPassword('');
      setMode('forgot_newpass');
    } catch (e) {
      setStepError(e.message);
    } finally {
      setStepLoading(false);
    }
  }

  async function handleSetPassword(e) {
    e.preventDefault();
    if (newPassword.length < 8) { setStepError('Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { setStepError('Passwords do not match.'); return; }
    setStepLoading(true);
    setStepError('');
    try {
      const { data, error } = await supabase.functions.invoke('confirm-password-reset', {
        body: { email: forgotEmail.trim(), otp: otpValue.trim(), newPassword },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to reset password. Please try again.');
      setMode('forgot_done');
    } catch (e) {
      setStepError(e.message);
      if (e.message?.toLowerCase().includes('invalid') || e.message?.toLowerCase().includes('expired')) {
        setMode('forgot_otp');
      }
    } finally {
      setStepLoading(false);
    }
  }

  const brandGradient = 'linear-gradient(135deg, #1B3A6E 0%, #2563EB 100%)';

  const BrandingPanel = () => (
    <div
      className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #F0F7FF 0%, #FFFFFF 55%, #F0FDF4 100%)', borderRight: '1px solid #E5EDF5' }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.12]" style={{ background: '#3DB83F', transform: 'translate(35%, -35%)' }} />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.10]" style={{ background: '#2563EB', transform: 'translate(-35%, 35%)' }} />
      <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full opacity-[0.05]" style={{ background: '#1B3A6E', transform: 'translate(-50%,-50%)' }} />

      <div className="relative z-10 flex flex-col items-center px-12 max-w-lg text-center">
        <div className="mb-5">
          <img src="/image_copy_copy.png" alt="HumanVerse360 Logo" className="w-32 h-32 object-contain drop-shadow-md" />
        </div>

        <div className="mb-1">
          <h1 className="text-[2.6rem] font-black tracking-tight leading-none select-none">
            <span style={{ color: '#1B3A6E' }}>Human</span>
            <span style={{ color: '#2563EB' }}>Verse</span>
            <span style={{ color: '#3DB83F' }}>360</span>
            <span className="text-2xl font-bold align-baseline ml-0.5" style={{ color: '#2563EB' }}>.com</span>
          </h1>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div className="h-px flex-1" style={{ background: '#CBD5E1' }} />
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase whitespace-nowrap" style={{ color: '#64748B' }}>
            HR &amp; PAYROLL. SIMPLIFIED. INTELLIGENT. SECURE.
          </p>
          <div className="h-px flex-1" style={{ background: '#CBD5E1' }} />
        </div>

        <p className="text-sm leading-relaxed mb-6" style={{ color: '#64748B' }}>
          A comprehensive cloud-based HR &amp; Payroll platform purpose-built for GCC companies.
          Manage your workforce, automate payroll, track leave, and ensure compliance — all from one
          intelligent platform.
        </p>

        <div className="w-full rounded-2xl px-5 py-4 mb-8 text-left shadow-sm" style={{ background: '#F8FAFC', border: '1px solid #E2EAF4' }}>
          <p className="text-sm leading-relaxed" style={{ color: '#334155' }}>
            Empowering People. Streamlining Payroll.{' '}
            <span className="font-bold" style={{ color: '#3DB83F' }}>Driving Success—Together.</span>
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {['Employee Management', 'Payroll Processing', 'Leave Tracking', 'Document Expiry', 'Employee Portal', 'Indemnity Calculator'].map(f => (
            <span key={f} className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-5 flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
        <span>Developed by</span>
        <a href="/about" className="font-medium transition-colors hover:text-slate-600" style={{ color: '#64748B' }}>
          Innovegic Consultancy &amp; IT Services Co W.L.L
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: '#F0F4F9' }}>
      <BrandingPanel />

      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-10">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/image_copy_copy.png" alt="HumanVerse360" className="w-12 h-12 object-contain" />
            <h1 className="text-2xl font-black leading-none">
              <span style={{ color: '#1B3A6E' }}>Human</span>
              <span style={{ color: '#2563EB' }}>Verse</span>
              <span style={{ color: '#3DB83F' }}>360</span>
            </h1>
          </div>
          <p className="text-xs text-gray-400 tracking-widest uppercase">HR &amp; PAYROLL. SIMPLIFIED. INTELLIGENT. SECURE.</p>
        </div>

        <div className="w-full max-w-sm">
          <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #1B3A6E, #2563EB 50%, #3DB83F)' }} />

          {/* ── SIGN IN ── */}
          {mode === 'login' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Welcome back</h2>
              <p className="text-sm text-gray-400 mb-7">Sign in to your company account</p>

              {loginError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-5 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{loginError}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <FormField label="Work Email" error={errors.email?.message}>
                  <Input {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                    type="email" placeholder="admin@company.com" autoComplete="email" error={errors.email} />
                </FormField>

                <div>
                  <FormField label="Password" error={errors.password?.message}>
                    <div className="relative">
                      <Input {...register('password', { required: 'Password is required' })}
                        type={showPass ? 'text' : 'password'} placeholder="••••••••"
                        autoComplete="current-password" error={errors.password} className="pr-10" />
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </FormField>
                  <div className="flex justify-end mt-1.5">
                    <button type="button" onClick={openForgot}
                      className="text-xs font-medium hover:underline transition-colors" style={{ color: '#2563EB' }}>
                      Forgot password?
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}>
                  {isSubmitting ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">New to HumanVerse360?{' '}
                  <Link to="/register" className="font-semibold hover:underline" style={{ color: '#3DB83F' }}>Register your company</Link>
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Enter email ── */}
          {mode === 'forgot_email' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <button type="button" onClick={() => setMode('login')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" />Back to sign in
              </button>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: '#EFF6FF' }}>
                <Mail className="w-6 h-6" style={{ color: '#2563EB' }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Reset your password</h2>
              <p className="text-sm text-gray-400 mb-6">Enter your work email and we'll send you a 6-digit verification code.</p>

              {stepError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{stepError}
                </div>
              )}

              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Work Email</label>
                  <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                    placeholder="admin@company.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
                </div>
                <button type="submit" disabled={stepLoading || !forgotEmail}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}>
                  {stepLoading ? 'Sending…' : 'Send Verification Code'}
                </button>
              </form>
            </div>
          )}

          {/* ── STEP 2: Enter OTP ── */}
          {mode === 'forgot_otp' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <button type="button" onClick={() => { setMode('forgot_email'); setStepError(''); }}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" />Back
              </button>
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: '#EFF6FF' }}>
                <ShieldCheck className="w-6 h-6" style={{ color: '#2563EB' }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Enter verification code</h2>
              <p className="text-sm text-gray-400 mb-1">We sent a 6-digit code to</p>
              <p className="text-sm font-semibold mb-6" style={{ color: '#1B3A6E' }}>{forgotEmail}</p>

              {stepError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{stepError}
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-5">
                <OtpInput value={otpValue} onChange={v => { setOtpValue(v); setStepError(''); }} />
                <button type="submit" disabled={stepLoading || otpValue.length < 6}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}>
                  {stepLoading ? 'Verifying…' : 'Verify Code'}
                </button>
              </form>

              <button type="button" onClick={() => { setOtpValue(''); setStepError(''); handleSendOtp({ preventDefault: () => {} }); }}
                className="w-full mt-3 py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Didn't receive it? Resend code
              </button>
            </div>
          )}

          {/* ── STEP 3: New password ── */}
          {mode === 'forgot_newpass' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl mb-4" style={{ background: '#EFF6FF' }}>
                <KeyRound className="w-6 h-6" style={{ color: '#2563EB' }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#1B3A6E' }}>Set new password</h2>
              <p className="text-sm text-gray-400 mb-6">Choose a strong password for your account.</p>

              {stepError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{stepError}
                </div>
              )}

              <form onSubmit={handleSetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">New Password</label>
                  <div className="relative">
                    <input type={showNewPass ? 'text' : 'password'} required minLength={8}
                      value={newPassword} onChange={e => { setNewPassword(e.target.value); setStepError(''); }}
                      placeholder="At least 8 characters" autoComplete="new-password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
                    <button type="button" onClick={() => setShowNewPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <StrengthBar password={newPassword} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirmPass ? 'text' : 'password'} required
                      value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setStepError(''); }}
                      placeholder="Re-enter password" autoComplete="new-password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
                    <button type="button" onClick={() => setShowConfirmPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                  )}
                </div>

                <button type="submit" disabled={stepLoading || !newPassword || !confirmPassword}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-60 hover:opacity-90 active:scale-[0.99]"
                  style={{ background: brandGradient }}>
                  {stepLoading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </div>
          )}

          {/* ── DONE ── */}
          {mode === 'forgot_done' && (
            <div className="bg-white rounded-b-2xl rounded-tr-2xl shadow-xl p-8 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4" style={{ background: '#F0FDF4' }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: '#3DB83F' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#1B3A6E' }}>Password updated!</h2>
              <p className="text-sm text-gray-500 mb-6">Your password has been changed successfully. You can now sign in with your new password.</p>
              <button type="button" onClick={() => { setMode('login'); setForgotEmail(''); setOtpValue(''); setNewPassword(''); setConfirmPassword(''); }}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.99]"
                style={{ background: brandGradient }}>
                Back to Sign In
              </button>
            </div>
          )}

          <p className="lg:hidden text-center text-xs text-gray-400 mt-5">
            <a href="/about" className="hover:text-gray-600 transition-colors">
              Powered by Innovegic Consultancy &amp; IT Services Co W.L.L
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
