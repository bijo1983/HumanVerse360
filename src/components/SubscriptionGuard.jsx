import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Crown, ArrowUpRight, Check, Users, Zap } from 'lucide-react';
import { MODULE_LABELS, PLANS, formatPlanPrice } from '../lib/plans';

export default function SubscriptionGuard({ module: moduleName, children }) {
  const { hasModuleAccess, subscription } = useAuth();

  if (!moduleName || hasModuleAccess(moduleName)) {
    return children;
  }

  return <UpgradePrompt module={moduleName} currentPlan={subscription} />;
}

function UpgradePrompt({ module: moduleName, currentPlan }) {
  const navigate = useNavigate();
  const currentPlanCode = currentPlan?.code || 'free';
  const moduleLabel = MODULE_LABELS[moduleName] || moduleName;

  const upgradePlans = Object.values(PLANS).filter(p => {
    return p.modules.includes(moduleName) && p.code !== currentPlanCode;
  });

  const nextPlan = upgradePlans[0] || PLANS.small;

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg w-full text-center">
        <div className="card p-10">
          <div className="w-16 h-16 bg-warning-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-warning-500" />
          </div>

          <h2 className="text-xl font-bold text-secondary-900 mb-2">
            {moduleLabel} requires an upgrade
          </h2>
          <p className="text-sm text-secondary-500 mb-6">
            Your current plan <strong>{currentPlan?.name || 'Free'}</strong> does not include {moduleLabel}.
            Upgrade to unlock this feature and streamline your HR operations.
          </p>

          {/* Feature Highlight */}
          <div className="grid grid-cols-1 gap-2 mb-6 text-left">
            {getModuleFeatures(moduleName).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-secondary-600">
                <Check className="w-4 h-4 text-accent-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          {/* Next Plan */}
          <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl mb-5 text-left">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary-600" />
                <span className="font-semibold text-primary-800">{nextPlan.name}</span>
              </div>
              <span className="font-bold text-primary-900">{formatPlanPrice(nextPlan.price)}</span>
            </div>
            <p className="text-xs text-primary-600">
              {nextPlan.maxEmployees === Infinity ? 'Unlimited' : `Up to ${nextPlan.maxEmployees}`} employees · All modules included
            </p>
          </div>

          <button onClick={() => navigate('/subscription')} className="btn-primary w-full justify-center py-2.5">
            <Zap className="w-4 h-4" /> Upgrade Plan
          </button>

          <button onClick={() => navigate(-1)} className="btn-ghost w-full justify-center mt-2">
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}

function getModuleFeatures(moduleName) {
  const features = {
    leave: [
      'Bahrain Labor Law compliant leave types (Annual, Sick, Maternity...)',
      'Auto leave balance calculation and accrual',
      'Approval workflow with reject/approve actions',
      'Leave calendar and balance reports',
    ],
    payroll: [
      'One-click monthly payroll generation',
      'GOSI calculation (7% employee, 12% employer)',
      'Overtime and bonus processing',
      'Printable salary slips for each employee',
    ],
    indemnity: [
      'End of service indemnity (Article 116)',
      'Resignation vs. termination factor calculation',
      'Final settlement with leave encashment',
      'Notice pay and deduction calculation',
    ],
    settings: [
      'Dynamic formula engine for all HR calculations',
      'Configure overtime rates, GOSI, leave accrual',
      'Test formulas with live variable inputs',
      'Organization structure management',
    ],
    ess: [
      'Mobile-native Employee Self Service portal',
      'Employees can view payslips and leave balances',
      'Online leave application and tracking',
      'Document expiry alerts for employees',
    ],
    database: [
      'Connect to MariaDB hosted on DigitalOcean',
      'Custom database integration',
      'Data migration support',
      'Database health monitoring',
    ],
  };
  return features[moduleName] || ['Full access to this module', 'Bahrain Labor Law compliance', 'Priority support'];
}
