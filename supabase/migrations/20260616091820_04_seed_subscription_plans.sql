
/*
# Seed Subscription Plans

Inserts the four Humanverse360 subscription tiers with module access arrays.
Module codes: employees, documents, leave, payroll, indemnity, settings, ess, database
*/

INSERT INTO subscription_plans (name, code, price_bhd, max_employees, modules, description, features, is_popular, sort_order) VALUES
(
  'Free',
  'free',
  0,
  10,
  ARRAY['employees', 'documents'],
  'Get started with basic employee management at no cost.',
  '[
    "Up to 10 employees",
    "Employee profiles & records",
    "Document expiry tracking",
    "Passport, Visa, CPR alerts",
    "Email support"
  ]'::jsonb,
  false,
  1
),
(
  'Small Enterprise',
  'small',
  20.000,
  25,
  ARRAY['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  'Perfect for growing teams up to 25 employees.',
  '[
    "Up to 25 employees",
    "All Free features",
    "Leave management (Bahrain Labor Law)",
    "Monthly payroll processing",
    "Salary slip generation",
    "Indemnity calculator",
    "Employee Self Service (ESS)",
    "Calculation settings (formula engine)",
    "Priority support"
  ]'::jsonb,
  false,
  2
),
(
  'Medium Enterprise',
  'medium',
  50.000,
  100,
  ARRAY['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  'Scale up to 100 employees with full HR capabilities.',
  '[
    "Up to 100 employees",
    "All Small Enterprise features",
    "Advanced payroll reporting",
    "Multi-department management",
    "Bulk employee imports",
    "Database connection (MariaDB/DigitalOcean)",
    "Dedicated account manager",
    "Phone & email support"
  ]'::jsonb,
  true,
  3
),
(
  'Large Enterprise',
  'large',
  250.000,
  NULL,
  ARRAY['employees', 'documents', 'leave', 'payroll', 'indemnity', 'settings', 'ess', 'database'],
  'Unlimited employees for large organizations.',
  '[
    "Unlimited employees",
    "All Medium Enterprise features",
    "Custom integrations",
    "White-label options",
    "SLA guaranteed uptime",
    "Dedicated implementation team",
    "24/7 priority support",
    "Custom reporting"
  ]'::jsonb,
  false,
  4
)
ON CONFLICT (code) DO NOTHING;
