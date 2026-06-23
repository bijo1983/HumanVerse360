INSERT INTO calculation_settings (name, code, category, formula, variables, example, description, is_active, sort_order)
VALUES
  (
    'Overtime Amount (Normal)',
    'OT_AMOUNT_NORMAL',
    'Overtime',
    '(basic_salary / (days_in_month * 8)) * ot_hours * 1.25',
    '["basic_salary","days_in_month","ot_hours"]'::jsonb,
    'BHD 300 ÷ (31 × 8) × 10 × 1.25 = BHD 15.121',
    'Normal weekday overtime at 1.25× multiplier per Bahrain Labour Law',
    true,
    10
  ),
  (
    'Overtime Amount (Holiday)',
    'OT_AMOUNT_HOLIDAY',
    'Overtime',
    '(basic_salary / (days_in_month * 8)) * ot_hours * 1.5',
    '["basic_salary","days_in_month","ot_hours"]'::jsonb,
    'BHD 300 ÷ (31 × 8) × 10 × 1.5 = BHD 18.145',
    'Holiday/Friday overtime at 1.5× multiplier per Bahrain Labour Law',
    true,
    11
  ),
  (
    'Gross Salary',
    'GROSS_SALARY',
    'Payroll',
    'basic_salary + housing_allowance + transport_allowance + food_allowance + other_allowances',
    '["basic_salary","housing_allowance","transport_allowance","food_allowance","other_allowances"]'::jsonb,
    'BHD 300 + 100 + 30 + 20 + 0 = BHD 450.000',
    'Total gross salary: basic + all allowances (before deductions)',
    true,
    20
  ),
  (
    'Prorated Basic Salary',
    'BASIC_PRORATED',
    'Payroll',
    '(basic_salary / days_in_month) * working_days',
    '["basic_salary","days_in_month","working_days"]'::jsonb,
    'BHD 300 ÷ 31 × 20 = BHD 193.548',
    'Basic salary prorated for partial month attendance',
    true,
    21
  ),
  (
    'GOSI Employee Contribution (Bahraini)',
    'GOSI_EMP_BAHRAINI',
    'GOSI',
    'basic_salary * 0.08',
    '["basic_salary"]'::jsonb,
    'BHD 300 × 8% = BHD 24.000',
    'Employee GOSI: 7% pension + 1% unemployment insurance on basic salary',
    true,
    30
  ),
  (
    'GOSI Employer Contribution (Bahraini)',
    'GOSI_ER_BAHRAINI',
    'GOSI',
    'basic_salary * 0.13',
    '["basic_salary"]'::jsonb,
    'BHD 300 × 13% = BHD 39.000',
    'Employer GOSI: 12% pension + 1% unemployment insurance on basic salary',
    true,
    31
  ),
  (
    'GOSI Employee Contribution (Expat)',
    'GOSI_EMP_EXPAT',
    'GOSI',
    'basic_salary * 0.01',
    '["basic_salary"]'::jsonb,
    'BHD 300 × 1% = BHD 3.000',
    'Expat employee GOSI: 1% work injury insurance on basic salary',
    true,
    32
  ),
  (
    'GOSI Employer Contribution (Expat)',
    'GOSI_ER_EXPAT',
    'GOSI',
    'basic_salary * 0.03',
    '["basic_salary"]'::jsonb,
    'BHD 300 × 3% = BHD 9.000',
    'Expat employer GOSI: 3% work injury insurance on basic salary',
    true,
    33
  ),
  (
    'Total Deductions',
    'TOTAL_DEDUCTIONS',
    'Payroll',
    'gosi_employee + loan_deduction + other_deductions',
    '["gosi_employee","loan_deduction","other_deductions"]'::jsonb,
    'BHD 24 + 0 + 0 = BHD 24.000',
    'Sum of all employee deductions: GOSI + loan + other',
    true,
    40
  ),
  (
    'Net Salary',
    'NET_SALARY',
    'Payroll',
    'gross_salary - total_deductions',
    '["gross_salary","total_deductions"]'::jsonb,
    'BHD 450.000 − BHD 24.000 = BHD 426.000',
    'Net take-home pay: gross salary minus all deductions',
    true,
    50
  )
ON CONFLICT (code) DO NOTHING;
