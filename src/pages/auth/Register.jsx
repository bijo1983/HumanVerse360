import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Shield, Check, ChevronRight, ChevronLeft, AlertCircle, Star, Users, Building2, Mail, RefreshCw } from 'lucide-react';
import { FormField, Input, Select } from '../../components/ui/Form';
import { useForm } from 'react-hook-form';

const PLAN_COLORS = {
  free: { bg: 'bg-secondary-50', border: 'border-secondary-200', badge: 'bg-secondary-100 text-secondary-600', btn: 'btn-secondary' },
  small: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700', btn: 'btn-primary' },
  medium: { bg: 'bg-primary-50', border: 'border-primary-300', badge: 'bg-primary-600 text-white', btn: 'btn-primary' },
  large: { bg: 'bg-secondary-900', border: 'border-secondary-700', badge: 'bg-accent-500 text-white', btn: 'btn-primary' },
};

function usePlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

const STEPS = ['Choose Plan', 'Company Details', 'Admin Account', 'Verify Email'];

const INDUSTRIES = [
  'Construction', 'Retail & Trading', 'Healthcare', 'Hospitality & Food',
  'Financial Services', 'Information Technology', 'Manufacturing', 'Oil & Gas',
  'Education', 'Real Estate', 'Transportation & Logistics', 'Consulting', 'Other',
];

const GCC_COUNTRIES = [
  { code: 'BH', name: 'Bahrain' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'QA', name: 'Qatar' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'OM', name: 'Oman' },
  { code: 'JO', name: 'Jordan' },
  { code: 'EG', name: 'Egypt' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PH', name: 'Philippines' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'OTHER', name: 'Other' },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function callEdgeFunction(slug, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function Register() {
  const navigate = useNavigate();
  const { registerCompany } = useAuth();
  const { data: plans = [] } = usePlans();
  const [step, setStep] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpRefs = useRef([]);
  const cooldownRef = useRef(null);

  const companyForm = useForm();
  const accountForm = useForm();

  const handlePlanSelect = (plan) => {
    setSelectedPlan(plan);
    setStep(1);
  };

  const handleCompanyNext = companyForm.handleSubmit(() => setStep(2));

  // Step 2 → send OTP then go to step 3
  const handleAccountNext = accountForm.handleSubmit(async (accountData) => {
    setError('');
    setLoading(true);
    try {
      const result = await callEdgeFunction('send-otp', { email: accountData.email });
      if (!result.success) throw new Error(result.error || 'Failed to send verification code.');
      setOtpDigits(['', '', '', '', '', '']);
      startCooldown();
      setStep(3);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  });

  function startCooldown() {
    setResendCooldown(60);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      const email = accountForm.getValues('email');
      const result = await callEdgeFunction('send-otp', { email });
      if (!result.success) throw new Error(result.error || 'Failed to resend code.');
      setOtpDigits(['', '', '', '', '', '']);
      startCooldown();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index, value) {
    const digit = value.replace(/\D/, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  }

  async function handleVerifyAndRegister() {
    const otp = otpDigits.join('');
    if (otp.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError('');
    setLoading(true);
    try {
      const email = accountForm.getValues('email');
      const verifyResult = await callEdgeFunction('verify-otp', { email, otp });
      if (!verifyResult.valid) throw new Error(verifyResult.error || 'Invalid verification code.');

      const accountData = accountForm.getValues();
      const companyData = companyForm.getValues();
      await registerCompany({
        companyName: companyData.name,
        email: accountData.email,
        password: accountData.password,
        fullName: accountData.full_name,
        planId: selectedPlan.id,
        crNumber: companyData.cr_number,
        phone: companyData.phone,
        industry: companyData.industry,
        countryCode: companyData.country_code,
        country: GCC_COUNTRIES.find(c => c.code === companyData.country_code)?.name || companyData.country_code,
      });
      navigate('/');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-900 via-primary-950 to-secondary-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-2xl shadow-lg mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Register your Company</h1>
          <p className="text-secondary-400 text-sm mt-1">Set up Humanverse360 for your organization</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                i === step ? 'bg-primary-600 text-white' :
                i < step ? 'bg-accent-500 text-white' :
                'bg-white/10 text-secondary-400'
              }`}>
                {i < step ? <Check className="w-3.5 h-3.5" /> : <span className="w-4 text-center">{i + 1}</span>}
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-secondary-600" />}
            </div>
          ))}
        </div>

        {/* Step 0: Plan Selection */}
        {step === 0 && (
          <div>
            <h2 className="text-center text-white text-lg font-semibold mb-6">Choose your plan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map(plan => {
                const c = PLAN_COLORS[plan.code] || PLAN_COLORS.free;
                const isLarge = plan.code === 'large';
                const features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
                return (
                  <div key={plan.id}
                    className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all hover:scale-105 hover:shadow-xl ${c.bg} ${c.border} ${isLarge ? 'text-white' : ''}`}
                    onClick={() => handlePlanSelect(plan)}>
                    {plan.is_popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                          <Star className="w-3 h-3" fill="currentColor" /> Most Popular
                        </span>
                      </div>
                    )}
                    <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${c.badge}`}>
                      {plan.name}
                    </div>
                    <div className="mb-3">
                      {plan.price_bhd === 0 ? (
                        <span className={`text-3xl font-bold ${isLarge ? 'text-white' : 'text-secondary-900'}`}>Free</span>
                      ) : (
                        <div>
                          <span className={`text-3xl font-bold ${isLarge ? 'text-white' : 'text-secondary-900'}`}>BHD {plan.price_bhd}</span>
                          <span className={`text-sm ml-1 ${isLarge ? 'text-secondary-300' : 'text-secondary-400'}`}>/month</span>
                        </div>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 text-sm mb-4 ${isLarge ? 'text-secondary-300' : 'text-secondary-500'}`}>
                      <Users className="w-3.5 h-3.5" />
                      {plan.max_employees ? `Up to ${plan.max_employees} employees` : 'Unlimited employees'}
                    </div>
                    <ul className="space-y-1.5 mb-5">
                      {features.slice(0, 5).map((f, i) => (
                        <li key={i} className={`flex items-start gap-1.5 text-xs ${isLarge ? 'text-secondary-300' : 'text-secondary-600'}`}>
                          <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isLarge ? 'text-accent-400' : 'text-accent-500'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full justify-center ${c.btn} ${isLarge ? 'bg-primary-600 text-white border-0' : ''}`}
                      onClick={() => handlePlanSelect(plan)}>
                      Get Started
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-center text-secondary-500 text-sm mt-6">
              Already registered?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign in here</Link>
            </p>
          </div>
        )}

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <div className="flex items-center gap-2 mb-5">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-bold text-secondary-900">Company Information</h2>
              </div>
              {selectedPlan && (
                <div className="flex items-center justify-between p-3 bg-primary-50 rounded-xl border border-primary-100 mb-5 text-sm">
                  <span className="text-secondary-600">Selected Plan:</span>
                  <span className="font-semibold text-primary-700">{selectedPlan.name} — {selectedPlan.price_bhd === 0 ? 'Free' : `BHD ${selectedPlan.price_bhd}/mo`}</span>
                </div>
              )}
              <form className="space-y-4">
                <FormField label="Company Name" required error={companyForm.formState.errors.name?.message}>
                  <Input {...companyForm.register('name', { required: 'Company name is required' })} placeholder="Al Noor Trading W.L.L." />
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="CR Number">
                    <Input {...companyForm.register('cr_number')} placeholder="CR-XXXXXXX" />
                  </FormField>
                  <FormField label="Phone">
                    <Input {...companyForm.register('phone')} placeholder="+973 XXXX XXXX" />
                  </FormField>
                </div>
                <FormField label="Industry">
                  <Select {...companyForm.register('industry')}>
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </Select>
                </FormField>
                <FormField label="Country" required error={companyForm.formState.errors.country_code?.message}>
                  <Select {...companyForm.register('country_code', { required: 'Country is required' })}>
                    <option value="">Select country...</option>
                    {GCC_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </Select>
                </FormField>
              </form>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setStep(0)} className="btn-secondary flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleCompanyNext} className="btn-primary flex-1 justify-center">
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Admin Account */}
        {step === 2 && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <h2 className="text-lg font-bold text-secondary-900 mb-1">Create Admin Account</h2>
              <p className="text-sm text-secondary-500 mb-5">This will be the main administrator for your company</p>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-error-50 border border-error-200 rounded-xl mb-4 text-sm text-error-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form className="space-y-4">
                <FormField label="Full Name" required error={accountForm.formState.errors.full_name?.message}>
                  <Input {...accountForm.register('full_name', { required: 'Required' })} placeholder="Mohammed Al Rashid" />
                </FormField>
                <FormField label="Work Email" required error={accountForm.formState.errors.email?.message}>
                  <Input {...accountForm.register('email', { required: 'Required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })} type="email" placeholder="admin@company.com" />
                </FormField>
                <FormField label="Password" required error={accountForm.formState.errors.password?.message}>
                  <Input {...accountForm.register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} type="password" placeholder="Minimum 8 characters" />
                </FormField>
                <FormField label="Confirm Password" required error={accountForm.formState.errors.confirm?.message}>
                  <Input {...accountForm.register('confirm', { required: 'Required', validate: (v) => v === accountForm.watch('password') || 'Passwords do not match' })} type="password" placeholder="Repeat password" />
                </FormField>
              </form>

              <div className="p-3 bg-secondary-50 rounded-xl border border-secondary-100 text-xs text-secondary-500 mt-4">
                By registering, you agree to Humanverse360 Terms of Service. Your company data is encrypted and isolated from other organizations.
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => { setError(''); setStep(1); }} className="btn-secondary flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleAccountNext} disabled={loading} className="btn-primary flex-1 justify-center">
                  {loading ? 'Sending code...' : <>Send Verification Code <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Verify Email (OTP) */}
        {step === 3 && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl p-8">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-50 rounded-2xl mb-3">
                  <Mail className="w-7 h-7 text-primary-600" />
                </div>
                <h2 className="text-lg font-bold text-secondary-900">Check your email</h2>
                <p className="text-sm text-secondary-500 mt-1">
                  We sent a 6-digit verification code to
                </p>
                <p className="text-sm font-semibold text-primary-700 mt-0.5">
                  {accountForm.getValues('email')}
                </p>
              </div>

              {error && (
                <div className="p-3 bg-error-50 border border-error-200 rounded-xl mb-4">
                  <div className="flex items-start gap-2 text-sm text-error-700 mb-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="font-medium">Registration failed</span>
                  </div>
                  <pre className="text-xs text-error-800 whitespace-pre-wrap break-all font-mono bg-error-100 rounded p-2 select-all">{error}</pre>
                </div>
              )}

              {/* OTP digit inputs */}
              <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className={`w-11 h-14 text-center text-xl font-bold rounded-xl border-2 outline-none transition-all
                      ${digit ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-secondary-200 bg-white text-secondary-900'}
                      focus:border-primary-500 focus:ring-2 focus:ring-primary-100`}
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyAndRegister}
                disabled={loading || otpDigits.join('').length < 6}
                className="btn-primary w-full justify-center mb-4"
              >
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button onClick={() => { setError(''); setStep(2); }} className="text-secondary-500 hover:text-secondary-700 flex items-center gap-1">
                  <ChevronLeft className="w-4 h-4" /> Change email
                </button>
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || loading}
                  className="flex items-center gap-1.5 text-primary-600 hover:text-primary-700 disabled:text-secondary-400 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>

              <p className="text-xs text-secondary-400 text-center mt-4">
                The code expires in 10 minutes. Check your spam folder if you don't see it.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
