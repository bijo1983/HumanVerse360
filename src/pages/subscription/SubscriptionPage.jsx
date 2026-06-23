import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PLANS, formatPlanPrice } from '../../lib/plans';
import {
  Crown, Check, Users, CreditCard, Building2, Star,
  AlertTriangle, CheckCircle, XCircle, Loader2, ExternalLink,
} from 'lucide-react';
import { formatDate } from '../../lib/calculations';
import { Badge } from '../../components/ui/Badge';

function usePlans() {
  return useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

const PLAN_STYLES = {
  free:   { ring: 'ring-secondary-200', bg: 'bg-white', headerBg: 'bg-secondary-50',  priceColor: 'text-secondary-900' },
  small:  { ring: 'ring-blue-200',      bg: 'bg-white', headerBg: 'bg-blue-50',        priceColor: 'text-blue-900' },
  medium: { ring: 'ring-primary-400',   bg: 'bg-white', headerBg: 'bg-primary-50',     priceColor: 'text-primary-900' },
  large:  { ring: 'ring-secondary-700', bg: 'bg-secondary-900', headerBg: 'bg-secondary-800', priceColor: 'text-white' },
};

export default function SubscriptionPage() {
  const { company, subscription, companyId, refreshCompany } = useAuth();
  const { data: plans = [] } = usePlans();

  const [upgrading, setUpgrading] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // null | 'verifying' | 'success' | 'failed'
  const [paymentMessage, setPaymentMessage] = useState('');

  const currentPlanCode = subscription?.code || 'free';

  // On mount: check if Tap redirected back with a charge ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tapId = params.get('tap_id');
    if (!tapId) return;
    window.history.replaceState({}, '', window.location.pathname);
    verifyCharge(tapId);
  }, []);

  async function verifyCharge(chargeId) {
    setPaymentStatus('verifying');
    setPaymentMessage('Verifying your payment…');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('tap-verify-charge', {
        body: { charge_id: chargeId },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.error) throw res.error;
      const result = res.data;
      if (!result?.success) throw new Error(result?.error || 'Verification failed');

      if (result.captured) {
        await refreshCompany();
        setPaymentStatus('success');
        setPaymentMessage('Payment successful! Your subscription has been activated.');
      } else {
        setPaymentStatus('failed');
        setPaymentMessage(`Payment ${result.status?.toLowerCase() || 'was not completed'}. No charge was made.`);
      }
    } catch (e) {
      setPaymentStatus('failed');
      setPaymentMessage(e.message || 'Could not verify payment. Please contact support.');
    }
  }

  async function handleUpgrade(plan) {
    if (plan.code === currentPlanCode || upgrading) return;

    // Free plan — direct downgrade, no payment
    if (!plan.price_bhd || plan.price_bhd <= 0) {
      setUpgrading(plan.id);
      try {
        const { error } = await supabase.from('companies').update({
          subscription_plan_id: plan.id,
          updated_at: new Date().toISOString(),
        }).eq('id', companyId);
        if (error) throw error;
        await refreshCompany();
        setPaymentStatus('success');
        setPaymentMessage(`Switched to ${plan.name}.`);
      } catch (e) {
        alert(e.message);
      } finally {
        setUpgrading(null);
      }
      return;
    }

    // Paid plan — initiate Tap charge
    setUpgrading(plan.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('tap-create-charge', {
        body: { plan_id: plan.id, company_id: companyId },
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      if (res.error) throw res.error;
      const result = res.data;
      if (!result?.success) throw new Error(result?.error || 'Failed to create payment');
      if (!result.checkout_url) throw new Error('No checkout URL returned from payment gateway');

      // Redirect to Tap hosted checkout — user comes back to /subscription?tap_id=...
      window.location.href = result.checkout_url;
    } catch (e) {
      alert(`Payment error: ${e.message}`);
      setUpgrading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Subscription & Billing</h2>
        <p className="text-sm text-secondary-500">Manage your HumanVerse360 subscription</p>
      </div>

      {paymentStatus === 'verifying' && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 animate-pulse">
          <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
          {paymentMessage}
        </div>
      )}
      {paymentStatus === 'success' && (
        <div className="flex items-center gap-2 p-4 bg-success-50 border border-success-200 rounded-xl text-sm text-success-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {paymentMessage}
        </div>
      )}
      {paymentStatus === 'failed' && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {paymentMessage}
        </div>
      )}

      {/* Current Plan Summary */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-secondary-400 uppercase font-semibold tracking-wide">Current Plan</p>
              <p className="text-xl font-bold text-secondary-900">{subscription?.name || 'Free'}</p>
              <p className="text-sm text-secondary-500 mt-0.5">
                {formatPlanPrice(subscription?.price_bhd || 0)} ·{' '}
                {subscription?.max_employees ? `Up to ${subscription.max_employees} employees` : 'Unlimited employees'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={company?.subscription_status === 'active' ? 'active' : 'warning'}>
              {company?.subscription_status || 'active'}
            </Badge>
            {company?.subscription_start && (
              <p className="text-xs text-secondary-400 mt-1">Since {formatDate(company.subscription_start)}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-secondary-100">
          {[
            ['Company', company?.name || '–', Building2],
            ['Plan', subscription?.name || 'Free', Crown],
            ['Billing', formatPlanPrice(subscription?.price_bhd || 0), CreditCard],
            ['Employees Limit', subscription?.max_employees ? `${subscription.max_employees}` : 'Unlimited', Users],
          ].map(([label, value, Icon]) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-xs text-secondary-400 mb-0.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <p className="text-sm font-semibold text-secondary-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Grid */}
      <div>
        <h3 className="font-semibold text-secondary-800 mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map(plan => {
            const s = PLAN_STYLES[plan.code] || PLAN_STYLES.free;
            const isCurrent = plan.code === currentPlanCode;
            const isLarge = plan.code === 'large';
            const isPaid = plan.price_bhd > 0;
            const isLoading = upgrading === plan.id;
            const features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');

            return (
              <div key={plan.id}
                className={`relative rounded-2xl ring-2 overflow-hidden transition-all hover:shadow-lg ${s.ring} ${s.bg}`}>
                {plan.is_popular && (
                  <div className="absolute top-0 right-0 bg-primary-600 text-white text-xs font-bold px-3 py-1.5 rounded-bl-xl flex items-center gap-1">
                    <Star className="w-3 h-3" fill="currentColor" /> Popular
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 left-0 bg-accent-500 text-white text-xs font-bold px-3 py-1.5 rounded-br-xl">
                    Current
                  </div>
                )}

                <div className={`p-5 ${s.headerBg}`}>
                  <p className={`font-bold text-base mb-1 ${isLarge ? 'text-white' : 'text-secondary-900'}`}>{plan.name}</p>
                  {plan.price_bhd === 0 ? (
                    <p className={`text-2xl font-bold ${s.priceColor}`}>Free</p>
                  ) : (
                    <p className={`text-2xl font-bold ${s.priceColor}`}>
                      BHD {plan.price_bhd}
                      <span className={`text-sm font-normal ml-1 ${isLarge ? 'text-secondary-400' : 'text-secondary-400'}`}>/mo</span>
                    </p>
                  )}
                  <p className={`text-xs mt-1 ${isLarge ? 'text-secondary-400' : 'text-secondary-500'}`}>
                    {plan.max_employees ? `Up to ${plan.max_employees} employees` : 'Unlimited employees'}
                  </p>
                </div>

                <div className="p-5">
                  <ul className="space-y-2 mb-5">
                    {features.slice(0, 6).map((f, i) => (
                      <li key={i} className={`flex items-start gap-2 text-xs ${isLarge ? 'text-secondary-300' : 'text-secondary-600'}`}>
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${isLarge ? 'text-accent-400' : 'text-accent-500'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isCurrent || !!upgrading}
                    className={`w-full flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg font-medium transition-all ${
                      isCurrent
                        ? 'bg-accent-100 text-accent-700 cursor-default'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    } disabled:opacity-60`}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing…</>
                    ) : isCurrent ? (
                      '✓ Current Plan'
                    ) : isPaid ? (
                      <><ExternalLink className="w-3.5 h-3.5" />Pay with Tap</>
                    ) : (
                      'Downgrade'
                    )}
                  </button>

                  {isPaid && !isCurrent && (
                    <p className="text-center text-[10px] text-secondary-400 mt-2">
                      Visa · Mastercard · Benefit · Apple Pay
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module Access Table */}
      <div className="card p-5">
        <h3 className="font-semibold text-secondary-800 mb-4">Module Availability by Plan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-secondary-200">
                <th className="text-left py-2 pr-4 text-secondary-500 font-semibold text-xs uppercase">Module</th>
                {plans.map(p => (
                  <th key={p.id} className={`px-4 py-2 text-center text-xs font-semibold ${p.code === currentPlanCode ? 'text-primary-600' : 'text-secondary-500'}`}>
                    {p.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Employee Management', 'employees'],
                ['Document & Expiry Alerts', 'documents'],
                ['Leave Management', 'leave'],
                ['Payroll Processing', 'payroll'],
                ['Indemnity & Settlement', 'indemnity'],
                ['Calculation Settings', 'settings'],
                ['Employee Self Service (ESS)', 'ess'],
              ].map(([label, code]) => (
                <tr key={code} className="border-b border-secondary-100">
                  <td className="py-2.5 pr-4 text-secondary-700 text-sm">{label}</td>
                  {plans.map(p => {
                    const mods = Array.isArray(p.modules) ? p.modules : [];
                    return (
                      <td key={p.id} className="px-4 py-2.5 text-center">
                        {mods.includes(code)
                          ? <Check className="w-4 h-4 text-accent-500 mx-auto" />
                          : <span className="text-secondary-200 text-lg">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Payments are processed securely by <strong>Tap Payments</strong>. You will be redirected to Tap's
          hosted checkout to complete your payment with Visa, Mastercard, Benefit, or Apple Pay.
          Subscriptions activate immediately on successful payment.
          For billing questions contact <strong>info@innovegicit.com</strong>.
        </p>
      </div>
    </div>
  );
}
