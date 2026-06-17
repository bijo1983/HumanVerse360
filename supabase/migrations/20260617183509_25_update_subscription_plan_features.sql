-- Update subscription plan features:
-- Free: CPR -> National ID
-- Medium: Remove "Database connection (MariaDB/DigitalOcean)", add "Custom integrations"
-- Large: Remove "White-label options"

UPDATE subscription_plans SET features = '[
  "Up to 10 employees",
  "Employee profiles & records",
  "Document expiry tracking",
  "Passport, Visa, National ID alerts",
  "Email support"
]'::jsonb WHERE code = 'free';

UPDATE subscription_plans SET features = '[
  "Up to 100 employees",
  "All Small Enterprise features",
  "Advanced payroll reporting",
  "Multi-department management",
  "Bulk employee imports",
  "Custom integrations",
  "Dedicated account manager",
  "Phone & email support"
]'::jsonb WHERE code = 'medium';

UPDATE subscription_plans SET features = '[
  "Unlimited employees",
  "All Medium Enterprise features",
  "Custom integrations",
  "SLA guaranteed uptime",
  "Dedicated implementation team",
  "24/7 priority support",
  "Custom reporting",
  "On-premise deployment option"
]'::jsonb WHERE code = 'large';
