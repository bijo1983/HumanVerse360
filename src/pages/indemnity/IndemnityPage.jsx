import { useState } from 'react';
import { Calculator, FileText, TrendingDown, Info } from 'lucide-react';
import { useEmployees } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { FormField, Select, Input } from '../../components/ui/Form';
import { formatCurrency, formatDate, calculateIndemnity, getServiceYears, getServiceMonths, getCalendarDaysInMonth } from '../../lib/calculations';
import { calculateEosb } from '../../lib/eosbEngine';
import { isCitizenOf } from '../../lib/statutory';
import { useEosbRule } from '../../hooks/usePayroll';
import { differenceInDays, parseISO, format } from 'date-fns';

export default function IndemnityPage() {
  const [tab, setTab] = useState('calculator');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-secondary-900">Indemnity & Final Settlement</h2>
        <p className="text-sm text-secondary-500">Bahrain Labor Law Art. 116 compliant indemnity calculation</p>
      </div>
      <div className="flex gap-1 border-b border-secondary-200">
        {[['calculator', 'Indemnity Calculator'], ['settlement', 'Final Settlement'], ['rules', 'BH Labor Law Rules']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'calculator' && <IndemnityCalculator />}
      {tab === 'settlement' && <FinalSettlement />}
      {tab === 'rules' && <LaborLawRules />}
    </div>
  );
}

function IndemnityCalculator() {
  const { companyId, company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  const { data: eosbRule } = useEosbRule(countryCode);
  const { data: employees = [] } = useEmployees({}, companyId);
  const [empId, setEmpId] = useState('');
  const [terminationType, setTerminationType] = useState('Termination');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [result, setResult] = useState(null);

  const selectedEmp = employees.find(e => e.id === empId);
  const isBahraini = selectedEmp?.nationality?.toLowerCase() === 'bahraini';

  const calculate = () => {
    if (!selectedEmp) return;
    const basicSalary = selectedEmp.basic_salary || 0;
    const joining = selectedEmp.joining_date;
    // Bahrain keeps the legacy Art. 116 calculation (exact parity);
    // other countries use their eosb_rules band configuration.
    const res = countryCode === 'BH' || !eosbRule
      ? calculateIndemnity(basicSalary, joining, endDate, terminationType)
      : (() => {
          const r = calculateEosb(eosbRule, {
            baseSalary: basicSalary,
            joiningDate: joining,
            endDate,
            terminationReason: terminationType,
            isCitizen: isCitizenOf(countryCode, selectedEmp.nationality),
          });
          return { amount: r.amount, breakdown: r.breakdown.join(' · ') || eosbRule.rule_name };
        })();
    const years = getServiceYears(joining, endDate);
    const months = getServiceMonths(joining, endDate);
    const days = differenceInDays(parseISO(endDate), parseISO(joining));
    // GOSI rates based on nationality
    const gosiEmpRate  = isBahraini ? 0.08 : 0.01;
    const gosiErRate   = isBahraini ? 0.13 : 0.03;
    const gosiEmployee = basicSalary * gosiEmpRate;
    const gosiEmployer = basicSalary * gosiErRate;
    setResult({ ...res, years, months, days, basicSalary, joining, gosiEmployee, gosiEmployer, gosiEmpRate, gosiErRate });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6">
        <h3 className="section-title mb-4 flex items-center gap-2"><Calculator className="w-4 h-4 text-primary-500" /> Calculate Indemnity</h3>
        <div className="space-y-4">
          <FormField label="Select Employee" required>
            <Select value={empId} onChange={e => { setEmpId(e.target.value); setResult(null); }}>
              <option value="">Choose an employee...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.first_name} {e.last_name} ({e.employee_id}) – Joined {formatDate(e.joining_date)}
                </option>
              ))}
            </Select>
          </FormField>

          {selectedEmp && (
            <div className="p-3 bg-secondary-50 rounded-lg text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-secondary-400">Basic Salary:</span><span className="font-semibold">{formatCurrency(selectedEmp.basic_salary)}</span></div>
              <div className="flex justify-between"><span className="text-secondary-400">Joining Date:</span><span className="font-semibold">{formatDate(selectedEmp.joining_date)}</span></div>
              <div className="flex justify-between"><span className="text-secondary-400">Service Years:</span><span className="font-semibold">{getServiceYears(selectedEmp.joining_date, endDate)} years</span></div>
              <div className="flex justify-between">
                <span className="text-secondary-400">Nationality:</span>
                <span className={`font-semibold px-2 py-0.5 rounded text-xs ${isBahraini ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedEmp.nationality || 'Not specified'} · {isBahraini ? 'GOSI Pension' : 'GOSI Work Injury'}
                </span>
              </div>
            </div>
          )}

          <FormField label="Termination Type">
            <Select value={terminationType} onChange={e => { setTerminationType(e.target.value); setResult(null); }}>
              <option value="Termination">Termination by Employer</option>
              <option value="Resignation">Resignation by Employee</option>
            </Select>
          </FormField>

          <FormField label="Last Working Day">
            <Input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setResult(null); }} />
          </FormField>

          <button onClick={calculate} disabled={!empId} className="btn-primary w-full justify-center">
            <Calculator className="w-4 h-4" /> Calculate Indemnity
          </button>
        </div>
      </div>

      {/* Result */}
      <div>
        {result ? (
          <div className="space-y-4">
            <div className="card p-6 bg-gradient-to-br from-primary-900 to-primary-800 text-white">
              <p className="text-primary-200 text-sm">Total Indemnity Amount (Article 116)</p>
              <p className="text-4xl font-bold mt-1">{formatCurrency(result.amount)}</p>
              <p className="text-primary-300 text-sm mt-2">{result.breakdown}</p>
            </div>

            <div className="card p-5">
              <h4 className="font-semibold text-secondary-800 mb-3">Calculation Breakdown</h4>
              <div className="space-y-3 text-sm">
                {[
                  ['Employee', `${selectedEmp?.first_name} ${selectedEmp?.last_name}`],
                  ['Nationality', selectedEmp?.nationality || 'Not specified'],
                  ['Basic Salary (Daily Rate)', `${formatCurrency(result.basicSalary)} ÷ 30 = ${formatCurrency(result.basicSalary / 30)}/day`],
                  ['Total Service', `${result.years} years, ${result.months % 12} months (${result.days} days)`],
                  ['Termination Type', terminationType],
                  ['Formula Applied', result.breakdown],
                  ['Indemnity Amount', formatCurrency(result.amount)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-start gap-2 py-2 border-b border-secondary-100 last:border-0">
                    <span className="text-secondary-400 min-w-0 flex-shrink-0">{k}</span>
                    <span className="font-medium text-secondary-800 text-right">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GOSI summary panel */}
            <div className={`p-4 rounded-xl border text-sm space-y-2 ${isBahraini ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="flex items-center gap-2 font-semibold">
                <Info className="w-4 h-4 flex-shrink-0" />
                {isBahraini ? 'GOSI – Pension & Unemployment (Monthly)' : 'GOSI – Work Injury Insurance (Monthly)'}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 rounded p-2">
                  <p className="text-xs font-semibold mb-1">Employee Contribution ({(result.gosiEmpRate * 100).toFixed(0)}%)</p>
                  <p className="font-mono font-bold">{formatCurrency(result.gosiEmployee)}</p>
                </div>
                <div className="bg-white/60 rounded p-2">
                  <p className="text-xs font-semibold mb-1">Employer Contribution ({(result.gosiErRate * 100).toFixed(0)}%)</p>
                  <p className="font-mono font-bold">{formatCurrency(result.gosiEmployer)}</p>
                </div>
              </div>
              {isBahraini && (
                <p className="text-xs">
                  Bahraini employees are registered with SIO (GOSI). Article 116 indemnity applies in addition to GOSI pension entitlements.
                </p>
              )}
              {!isBahraini && (
                <p className="text-xs">
                  Expat employees are covered for work injury only. Article 116 indemnity is fully payable by the employer upon end of service.
                </p>
              )}
            </div>

            {terminationType === 'Resignation' && result.years < 1 && (
              <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl text-sm text-warning-700">
                <strong>Note:</strong> Employee has less than 1 year of service. No indemnity is payable under Bahrain Labor Law.
              </div>
            )}
          </div>
        ) : (
          <div className="card p-12 text-center text-secondary-400">
            <Calculator className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Select an employee and click Calculate to see indemnity details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FinalSettlement() {
  const { companyId, company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  const { data: eosbRule } = useEosbRule(countryCode);
  const { data: employees = [] } = useEmployees({}, companyId);
  const [empId, setEmpId] = useState('');
  const [terminationType, setTerminationType] = useState('Termination');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [unusedLeave, setUnusedLeave] = useState(0);
  const [pendingExpenses, setPendingExpenses] = useState(0);
  const [loanBalance, setLoanBalance] = useState(0);
  const [result, setResult] = useState(null);

  const selectedEmp = employees.find(e => e.id === empId);
  const isBahraini = selectedEmp?.nationality?.toLowerCase() === 'bahraini';

  const calculate = () => {
    if (!selectedEmp) return;
    const basic = selectedEmp.basic_salary || 0;
    const gross = basic + (selectedEmp.housing_allowance || 0) +
      (selectedEmp.transport_allowance || 0) + (selectedEmp.food_allowance || 0) + (selectedEmp.other_allowances || 0);
    const { amount: indemnity, breakdown } = countryCode === 'BH' || !eosbRule
      ? calculateIndemnity(basic, selectedEmp.joining_date, endDate, terminationType)
      : (() => {
          const r = calculateEosb(eosbRule, {
            baseSalary: basic,
            joiningDate: selectedEmp.joining_date,
            endDate,
            terminationReason: terminationType,
            isCitizen: isCitizenOf(countryCode, selectedEmp.nationality),
          });
          return { amount: r.amount, breakdown: r.breakdown.join(' · ') || eosbRule.rule_name };
        })();
    const endDateObj = parseISO(endDate);
    const daysInMonth = getCalendarDaysInMonth(endDateObj);
    const dailyRate = gross / daysInMonth;
    const leavePay = (basic / daysInMonth) * unusedLeave;
    const noticePayDays = getServiceYears(selectedEmp.joining_date, endDate) >= 3 ? 30 : 14;
    const noticePay = dailyRate * noticePayDays;
    // GOSI: Bahraini 8% employee, Expat 1% employee
    const gosiRate = isBahraini ? 0.08 : 0.01;
    const gosiDeduction = basic * gosiRate;
    const totalPayable = indemnity + leavePay + parseFloat(pendingExpenses || 0) + noticePay;
    const totalDeductions = parseFloat(loanBalance || 0) + gosiDeduction;
    const netSettlement = totalPayable - totalDeductions;

    setResult({
      indemnity, breakdown, leavePay, noticePay, noticePayDays,
      totalPayable, totalDeductions, netSettlement,
      basic, gross, unusedLeave, gosiDeduction, gosiRate,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card p-6 space-y-4">
        <h3 className="section-title flex items-center gap-2"><FileText className="w-4 h-4 text-primary-500" /> Final Settlement</h3>

        <FormField label="Employee">
          <Select value={empId} onChange={e => { setEmpId(e.target.value); setResult(null); }}>
            <option value="">Select employee...</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_id})</option>)}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Termination Type">
            <Select value={terminationType} onChange={e => setTerminationType(e.target.value)}>
              <option value="Termination">Termination</option>
              <option value="Resignation">Resignation</option>
            </Select>
          </FormField>
          <FormField label="Last Working Day">
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </FormField>
        </div>

        <FormField label="Unused Annual Leave (days)">
          <Input type="number" min="0" value={unusedLeave} onChange={e => setUnusedLeave(e.target.value)} placeholder="0" />
        </FormField>

        <FormField label="Pending Expenses / Reimbursements (BHD)">
          <Input type="number" min="0" step="0.001" value={pendingExpenses} onChange={e => setPendingExpenses(e.target.value)} placeholder="0.000" />
        </FormField>

        <FormField label="Outstanding Loan Balance (BHD)">
          <Input type="number" min="0" step="0.001" value={loanBalance} onChange={e => setLoanBalance(e.target.value)} placeholder="0.000" />
        </FormField>

        <button onClick={calculate} disabled={!empId} className="btn-primary w-full justify-center">
          <Calculator className="w-4 h-4" /> Calculate Settlement
        </button>
      </div>

      <div>
        {result ? (
          <div className="space-y-4">
            <div className="card p-5">
              <h4 className="font-semibold text-secondary-800 mb-3">Settlement Statement</h4>
              <div className="space-y-2 text-sm">
                <div className="text-xs font-semibold text-secondary-400 uppercase mb-2">Payable</div>
                {[
                  ['End of Service Indemnity', result.indemnity],
                  [`Notice Pay (${result.noticePayDays} days)`, result.noticePay],
                  [`Leave Encashment (${result.unusedLeave}d)`, result.leavePay],
                  ['Pending Expenses', parseFloat(pendingExpenses || 0)],
                ].filter(([, v]) => v > 0).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-secondary-100">
                    <span className="text-secondary-600">{k}</span>
                    <span className="font-semibold font-mono text-success-700">{formatCurrency(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 border-b border-secondary-200 font-semibold">
                  <span>Total Payable</span>
                  <span className="font-mono text-success-700">{formatCurrency(result.totalPayable)}</span>
                </div>

                {result.totalDeductions > 0 && (
                  <>
                    <div className="text-xs font-semibold text-secondary-400 uppercase mt-3 mb-2">Deductions</div>
                    {result.gosiDeduction > 0 && (
                      <div className="flex justify-between py-1.5 border-b border-secondary-100">
                        <span className="text-secondary-600">GOSI – Employee ({(result.gosiRate * 100).toFixed(0)}%)</span>
                        <span className="font-semibold font-mono text-error-600">{formatCurrency(result.gosiDeduction)}</span>
                      </div>
                    )}
                    {parseFloat(loanBalance || 0) > 0 && (
                      <div className="flex justify-between py-1.5 border-b border-secondary-100">
                        <span className="text-secondary-600">Outstanding Loan</span>
                        <span className="font-semibold font-mono text-error-600">{formatCurrency(parseFloat(loanBalance))}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="card p-5 bg-gradient-to-br from-accent-600 to-accent-700 text-white">
              <p className="text-accent-100 text-sm">Net Settlement Amount</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(result.netSettlement)}</p>
              <p className="text-xs text-accent-200 mt-2">{result.breakdown}</p>
            </div>
          </div>
        ) : (
          <div className="card p-12 text-center text-secondary-400">
            <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Fill in the details and calculate to see the final settlement</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LaborLawRules() {
  const rules = [
    {
      title: 'Annual Leave (Article 57)',
      items: [
          'Minimum 30 calendar days per year after completing 1 year of service',
          'Accrual: 2.5 days per month',
          'Carry forward allowed by agreement',
          'Encashment of unused leave allowed at end of service',
      ],
    },
    {
      title: 'Sick Leave (Article 65)',
      items: [
        'First 15 days: Full pay',
        'Next 20 days: Half pay',
        'Next 20 days: No pay',
        'Certificate required after 3 consecutive days',
      ],
    },
    {
      title: 'Maternity Leave (Article 60)',
      items: [
        '60 days with full pay',
        'Applicable after 1 year of employment',
        'Additional 15 days unpaid may be taken',
      ],
    },
    {
      title: 'End of Service Indemnity (Article 116)',
      items: [
        'Less than 1 year: No indemnity',
        '1–3 years: 15 days basic salary per year',
        'Over 3 years: 1 month basic salary per year',
        'Resignation 1–3 years: 1/3 of entitlement',
        'Resignation 3–5 years: 2/3 of entitlement',
        'Resignation over 5 years: Full entitlement',
        'Termination: Full entitlement regardless of years',
      ],
    },
    {
      title: 'Working Hours (Article 38)',
      items: [
        'Maximum 48 hours per week / 8 hours per day',
        'Ramadan: 40 hours per week / 6 hours per day for Muslims',
        'Overtime: 1.25× hourly rate on weekdays',
        'Holiday overtime: 1.5× hourly rate',
      ],
    },
    {
      title: 'GOSI – Bahraini Nationals',
      items: [
        'Pension insurance: Employee 7% + Employer 12%',
        'Unemployment insurance: Employee 1% + Employer 1%',
        'Total: Employee 8% + Employer 13% of basic salary',
        'Administered by SIO (Social Insurance Organisation)',
        'Based on basic salary only, excludes allowances',
        'Article 116 indemnity applies in addition to GOSI pension',
      ],
    },
    {
      title: 'GOSI – Expat Employees',
      items: [
        'Work injury insurance only',
        'Employee contribution: 1% of basic salary',
        'Employer contribution: 3% of basic salary',
        'No pension or unemployment coverage for expats',
        'Based on basic salary only, excludes allowances',
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rules.map(rule => (
        <div key={rule.title} className="card p-5">
          <h3 className="font-semibold text-secondary-900 mb-3 text-sm">{rule.title}</h3>
          <ul className="space-y-1.5">
            {rule.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-secondary-600">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
