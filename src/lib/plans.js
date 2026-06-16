export const PLANS = {
  free: {
    code: 'free',
    name: 'Free',
    price: 0,
    maxEmployees: 10,
    modules: ['employees', 'documents'],
  },
  small: {
    code: 'small',
    name: 'Small Enterprise',
    price: 20,
    maxEmployees: 25,
    modules: ['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  },
  medium: {
    code: 'medium',
    name: 'Medium Enterprise',
    price: 50,
    maxEmployees: 100,
    modules: ['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  },
  large: {
    code: 'large',
    name: 'Large Enterprise',
    price: 250,
    maxEmployees: Infinity,
    modules: ['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  },
};

export const MODULE_LABELS = {
  employees: 'Employee Management',
  documents: 'Document & Expiry Alerts',
  leave: 'Leave Management',
  payroll: 'Payroll Processing',
  indemnity: 'Indemnity & Settlement',
  settings: 'Calculation Settings',
  ess: 'Employee Self Service',
  database: 'Database Integration',
};

export const ROUTE_MODULE = {
  '/': null,
  '/employees': 'employees',
  '/leave': 'leave',
  '/documents': 'documents',
  '/payroll': 'payroll',
  '/indemnity': 'indemnity',
  '/settings/calculations': 'settings',
  '/settings/general': 'settings',
  '/settings/database': 'database',
  '/ess': 'ess',
};

export function hasModuleAccess(planCode, moduleName) {
  if (!moduleName) return true;
  const plan = PLANS[planCode] || PLANS.free;
  return plan.modules.includes(moduleName);
}

export function isWithinEmployeeLimit(planCode, currentCount) {
  const plan = PLANS[planCode] || PLANS.free;
  if (plan.maxEmployees === Infinity) return true;
  return currentCount < plan.maxEmployees;
}

export function getPlanByCode(code) {
  return PLANS[code] || PLANS.free;
}

export function formatPlanPrice(price) {
  if (price === 0) return 'Free';
  return `BHD ${price}/month`;
}
