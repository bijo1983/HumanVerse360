import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PLANS, formatPlanPrice } from '../../lib/plans';
import { Crown, Check, Users, Calendar, CreditCard, Building2, Star, AlertTriangle, CheckCircle } from 'lucide-react';
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

export default function SubscriptionPage() {
  const { company, subscription, companyId, refreshCompany } = useAuth();
  const { data: plans = [] } = usePlans();
  const [upgrading, setUpgrading] = useState(null);
  const [success, setSuccess] = useState('');

  const currentPlanCode = subscription?.code || 'free';

  const handleUpgrade = async (plan) => {
    if (plan.code === currentPlanCode) return;
    setUpgrading(plan.id);
    try {
      const { error } = await supabase.from('companies').update({
        subscription_plan_id: plan.id,
        updated_at: new Date().toISOString(),
      }).eq('id', companyId);
      if (error) throw error;
      await refreshCompany();
      setSuccess(`Successfully upgraded to ${plan.name}!`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (e) {
      alert(e.message);
    } finally {
      setUpgrading(null);
    }
  };

  const PLAN_STYLES = {
    free: { ring: 'ring-secondary-200', bg: 'bg-white', headerBg: 'bg-secondary-50', priceColor: 'text-secondary-900' },
    small: { ring: 'ring-blue-200', bg: 'bg-white', headerBg: 'bg-blue-50', priceColor: 'text-blue-900' },
    medium: { ring: 'ring-primary-400', bg: 'bg-white', headerBg: 'bg-primary-50', priceColor: 'text-primary-900' },
    large: { ring: 'ring-secondary-700', bg: 'bg-secondary-900', headerBg: 'bg-secondary-800', priceColor: 'text-white' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Subscription & Billing</h2>
        <p className="text-sm text-secondary-500">Manage your Humanverse360 subscription</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-success-50 border border-success-200 rounded-xl text-sm text-success-700 animate-slide-up">
          <CheckCircle className="w-4 h-4" /> {success}
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
            const features = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
            const localPlan = PLANS[plan.code];

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
                      BHD {plan.price_bhd} <span className={`text-sm font-normal ${isLarge ? 'text-secondary-400' : 'text-secondary-400'}`}>/mo</span>
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
                    onClick={() => !isCurrent && handleUpgrade(plan)}
                    disabled={isCurrent || upgrading === plan.id}
                    className={`w-full justify-center text-sm py-2 rounded-lg font-medium transition-all ${
                      isCurrent
                        ? 'bg-accent-100 text-accent-700 cursor-default'
                        : isLarge
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    } disabled:opacity-60`}
                  >
                    {upgrading === plan.id ? 'Upgrading...' : isCurrent ? '✓ Current Plan' : plan.code === 'free' ? 'Downgrade' : 'Upgrade'}
                  </button>
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
                ['Database Integration', 'database'],
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
        <p>Plan changes take effect immediately. Downgrading will restrict access to modules not included in your new plan. Contact support for billing questions.</p>
      </div>
    </div>
  );
}
