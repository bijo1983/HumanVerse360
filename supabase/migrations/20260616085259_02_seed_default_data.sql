
/*
# Seed Default Data for Humanverse360

Seeds:
- Default departments
- Default leave types (Bahrain Labor Law compliant)
- Default salary components
- Default indemnity settings (Bahrain Law)
- Default calculation settings with formulas
*/

-- Default Departments
INSERT INTO departments (name, code, description) VALUES
  ('Human Resources', 'HR', 'HR and Administration'),
  ('Finance', 'FIN', 'Finance and Accounting'),
  ('Information Technology', 'IT', 'IT and Systems'),
  ('Operations', 'OPS', 'Operations and Logistics'),
  ('Sales & Marketing', 'SM', 'Sales and Marketing'),
  ('Management', 'MGT', 'Senior Management')
ON CONFLICT (code) DO NOTHING;

-- Default Leave Types (Bahrain Labor Law)
INSERT INTO leave_types (name, code, days_per_year, is_paid, requires_approval, carry_forward, max_carry_forward, gender_specific, applicable_after_months, description, color, sort_order) VALUES
  ('Annual Leave', 'AL', 30, true, true, true, 30, 'All', 12, 'Annual leave as per Bahrain Labor Law Article 57 - 30 days per year after completing one year of service', '#3B82F6', 1),
  ('Sick Leave', 'SL', 55, true, true, false, 0, 'All', 3, 'Sick leave per Article 65: 15 days full pay, 20 days half pay, 20 days without pay', '#EF4444', 2),
  ('Maternity Leave', 'ML', 60, true, true, false, 0, 'Female', 0, 'Maternity leave per Article 60 - 60 days with full pay', '#EC4899', 3),
  ('Paternity Leave', 'PL', 1, true, true, false, 0, 'Male', 0, 'Paternity leave - 1 day', '#8B5CF6', 4),
  ('Hajj Leave', 'HL', 14, true, true, false, 0, 'All', 24, 'Hajj leave once during service - 14 days', '#F59E0B', 5),
  ('Emergency Leave', 'EL', 6, true, true, false, 0, 'All', 0, 'Emergency/compassionate leave', '#F97316', 6),
  ('Unpaid Leave', 'UL', 365, false, true, false, 0, 'All', 0, 'Unpaid leave by agreement', '#6B7280', 7),
  ('Study Leave', 'STL', 30, true, true, false, 0, 'All', 12, 'Study/exam leave', '#14B8A6', 8)
ON CONFLICT (code) DO NOTHING;

-- Default Salary Components
INSERT INTO salary_components (name, code, component_type, calculation_type, default_value, is_gosi_applicable, sort_order, description) VALUES
  ('Basic Salary', 'BASIC', 'Earning', 'Fixed', 0, true, 1, 'Monthly basic salary'),
  ('Housing Allowance', 'HOUSE', 'Earning', 'Fixed', 0, false, 2, 'Monthly housing allowance'),
  ('Transport Allowance', 'TRANS', 'Earning', 'Fixed', 0, false, 3, 'Monthly transport allowance'),
  ('Food Allowance', 'FOOD', 'Earning', 'Fixed', 0, false, 4, 'Monthly food allowance'),
  ('Mobile Allowance', 'MOB', 'Earning', 'Fixed', 0, false, 5, 'Monthly mobile/phone allowance'),
  ('Overtime', 'OT', 'Earning', 'Formula', 0, false, 6, 'Overtime calculated at 1.25x hourly rate'),
  ('Performance Bonus', 'BONUS', 'Earning', 'Fixed', 0, false, 7, 'Discretionary performance bonus'),
  ('GOSI - Employee', 'GOSI_EMP', 'Deduction', 'Percentage', 7, false, 10, '7% employee GOSI contribution on basic salary (Bahraini nationals only)'),
  ('GOSI - Employer', 'GOSI_ER', 'Benefit', 'Percentage', 12, false, 11, '12% employer GOSI contribution'),
  ('Loan Deduction', 'LOAN', 'Deduction', 'Fixed', 0, false, 12, 'Monthly loan repayment deduction'),
  ('Absence Deduction', 'ABS', 'Deduction', 'Formula', 0, false, 13, 'Deduction for unauthorized absences'),
  ('Other Deductions', 'MISC_DED', 'Deduction', 'Fixed', 0, false, 14, 'Miscellaneous deductions')
ON CONFLICT (code) DO NOTHING;

-- Indemnity Settings (Bahrain Labor Law Art. 116)
INSERT INTO indemnity_settings (name, min_years, max_years, days_per_year, termination_type, resignation_factor, description, sort_order) VALUES
  ('Less than 1 year', 0, 1, 0, 'Both', 0, 'No indemnity for less than 1 year of service', 1),
  ('1-3 years (Termination)', 1, 3, 15, 'Termination', 1.0, 'Termination: 15 days basic salary per year', 2),
  ('1-3 years (Resignation)', 1, 3, 15, 'Resignation', 0.333, 'Resignation 1-3 years: 1/3 of 15 days per year', 3),
  ('3-5 years (Termination)', 3, 5, 30, 'Termination', 1.0, 'Termination: 1 month basic salary per year', 4),
  ('3-5 years (Resignation)', 3, 5, 30, 'Resignation', 0.667, 'Resignation 3-5 years: 2/3 of 1 month per year', 5),
  ('Over 5 years (Termination)', 5, null, 30, 'Termination', 1.0, 'Termination: 1 month basic salary per year', 6),
  ('Over 5 years (Resignation)', 5, null, 30, 'Resignation', 1.0, 'Resignation over 5 years: full 1 month per year', 7)
ON CONFLICT DO NOTHING;

-- Default Calculation Settings
INSERT INTO calculation_settings (category, name, code, formula, description, variables, example, sort_order) VALUES
  ('Payroll', 'Daily Rate', 'DAILY_RATE', 'gross_salary / working_days_per_month', 'Daily wage calculation', '["gross_salary", "working_days_per_month"]', 'BHD 500 / 26 = BHD 19.23/day', 1),
  ('Payroll', 'Hourly Rate', 'HOURLY_RATE', 'basic_salary / (working_days_per_month * daily_working_hours)', 'Hourly wage for overtime base', '["basic_salary", "working_days_per_month", "daily_working_hours"]', 'BHD 300 / (26 * 8) = BHD 1.44/hour', 2),
  ('Overtime', 'Overtime Rate (Normal)', 'OT_NORMAL', 'hourly_rate * ot_hours * 1.25', 'Overtime at 125% on weekdays per Bahrain Law Art. 57', '["hourly_rate", "ot_hours"]', 'BHD 1.44 * 10 * 1.25 = BHD 18.00', 3),
  ('Overtime', 'Overtime Rate (Holiday)', 'OT_HOLIDAY', 'hourly_rate * ot_hours * 1.5', 'Overtime at 150% on rest days/holidays', '["hourly_rate", "ot_hours"]', 'BHD 1.44 * 10 * 1.5 = BHD 21.60', 4),
  ('Leave', 'Annual Leave Accrual', 'AL_ACCRUAL', '(months_worked / 12) * 30', 'Monthly accrual: 2.5 days per month', '["months_worked"]', '6 months * 2.5 = 15 days', 5),
  ('Leave', 'Leave Pay', 'LEAVE_PAY', '(basic_salary / 26) * leave_days', 'Leave encashment at daily basic rate', '["basic_salary", "leave_days"]', 'BHD 300 / 26 * 10 = BHD 115.38', 6),
  ('GOSI', 'GOSI Employee (Bahraini)', 'GOSI_EMP_CALC', 'basic_salary * 0.07', 'Employee GOSI contribution 7% of basic (Bahraini nationals)', '["basic_salary"]', 'BHD 300 * 7% = BHD 21.00', 7),
  ('GOSI', 'GOSI Employer (Bahraini)', 'GOSI_ER_CALC', 'basic_salary * 0.12', 'Employer GOSI contribution 12% of basic (Bahraini nationals)', '["basic_salary"]', 'BHD 300 * 12% = BHD 36.00', 8),
  ('Indemnity', 'Service Years', 'SERVICE_YEARS', 'DATEDIFF(termination_date, joining_date) / 365.25', 'Total years of service', '["termination_date", "joining_date"]', '2024-01-01 to 2029-01-01 = 5 years', 9),
  ('Indemnity', 'Indemnity Amount', 'INDEMNITY_AMT', 'IF(years <= 3, (basic_salary / 26 * 15 * years), ((basic_salary / 26 * 15 * 3) + (basic_salary / 30 * (years - 3))))', 'Indemnity per Bahrain Labor Law Art. 116', '["basic_salary", "years"]', '5 years at BHD 300 basic = BHD 1096.15', 10),
  ('Payroll', 'Absence Deduction', 'ABS_DEDUCTION', '(gross_salary / working_days_per_month) * absent_days', 'Daily rate deduction per absence day', '["gross_salary", "working_days_per_month", "absent_days"]', 'BHD 500/26 * 2 = BHD 38.46', 11),
  ('Payroll', 'Working Days per Month', 'WORKING_DAYS', '26', 'Standard working days in Bahrain (26 days)', '[]', '26 days', 12)
ON CONFLICT (code) DO NOTHING;
