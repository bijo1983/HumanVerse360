import { useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../lib/calculations';
import { Printer, Download } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function SalarySlip({ employee, onClose }) {
  const { item, run } = employee;
  const emp = item?.employees;
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Salary Slip</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e2e8f0; padding: 6px 10px; }
        th { background: #f8fafc; font-weight: 600; text-align: left; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { font-size: 20px; color: #1e3a8a; }
        .row-total { font-weight: bold; background: #f0fdf4; }
        .deduction { color: #dc2626; }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (!item || !run) return null;

  const grossBreakdown = [
    { label: 'Basic Salary', amount: item.basic_salary },
    { label: 'Housing Allowance', amount: item.housing_allowance },
    { label: 'Transport Allowance', amount: item.transport_allowance },
    { label: 'Food Allowance', amount: item.food_allowance },
    { label: 'Other Allowances', amount: item.other_allowances },
    { label: 'Overtime', amount: item.overtime_amount },
    { label: 'Bonus', amount: item.bonus },
  ].filter(i => i.amount > 0);

  const deductionBreakdown = [
    { label: 'GOSI (Employee 7%)', amount: item.gosi_employee },
    { label: 'Loan Deduction', amount: item.loan_deduction },
    { label: 'Other Deductions', amount: item.other_deductions },
  ].filter(i => i.amount > 0);

  return (
    <Modal isOpen onClose={onClose} title="Salary Slip" size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn-primary"><Printer className="w-4 h-4" /> Print Slip</button>
        </div>
      }>
      <div ref={printRef}>
        {/* Header */}
        <div className="header text-center mb-6 pb-4 border-b border-secondary-200">
          <h1 className="text-xl font-bold text-primary-900">Humanverse360</h1>
          <p className="text-sm text-secondary-500">Salary Slip – {MONTHS[run.month - 1]} {run.year}</p>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div className="space-y-1.5">
            {[
              ['Employee Name', `${emp?.first_name} ${emp?.last_name}`],
              ['Employee ID', emp?.employee_id],
              ['Department', emp?.department_name],
              ['Designation', emp?.position_title],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-secondary-400 w-36 flex-shrink-0">{k}:</span>
                <span className="font-medium text-secondary-800">{v || '–'}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {[
              ['Pay Period', `${MONTHS[run.month - 1]} ${run.year}`],
              ['Working Days', item.working_days],
              ['Leave Days', item.leave_days || 0],
              ['Absent Days', item.absent_days || 0],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="text-secondary-400 w-36 flex-shrink-0">{k}:</span>
                <span className="font-medium text-secondary-800">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Earnings & Deductions */}
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="bg-secondary-50">
              <th className="px-4 py-2 text-left border border-secondary-200 text-secondary-600">Earnings</th>
              <th className="px-4 py-2 text-right border border-secondary-200 text-secondary-600">Amount (BHD)</th>
              <th className="px-4 py-2 text-left border border-secondary-200 text-secondary-600">Deductions</th>
              <th className="px-4 py-2 text-right border border-secondary-200 text-secondary-600">Amount (BHD)</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.max(grossBreakdown.length, deductionBreakdown.length) }).map((_, i) => (
              <tr key={i} className="border-b border-secondary-100">
                <td className="px-4 py-2 border border-secondary-100">{grossBreakdown[i]?.label || ''}</td>
                <td className="px-4 py-2 text-right border border-secondary-100 font-mono">
                  {grossBreakdown[i] ? formatCurrency(grossBreakdown[i].amount) : ''}
                </td>
                <td className="px-4 py-2 border border-secondary-100 text-error-700">{deductionBreakdown[i]?.label || ''}</td>
                <td className="px-4 py-2 text-right border border-secondary-100 font-mono text-error-700">
                  {deductionBreakdown[i] ? formatCurrency(deductionBreakdown[i].amount) : ''}
                </td>
              </tr>
            ))}
            <tr className="bg-secondary-50 font-semibold">
              <td className="px-4 py-2 border border-secondary-200">Total Earnings</td>
              <td className="px-4 py-2 text-right border border-secondary-200 font-mono">{formatCurrency(item.gross_salary)}</td>
              <td className="px-4 py-2 border border-secondary-200 text-error-700">Total Deductions</td>
              <td className="px-4 py-2 text-right border border-secondary-200 font-mono text-error-700">{formatCurrency(item.total_deductions)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net Pay */}
        <div className="bg-primary-900 text-white rounded-xl p-4 text-center">
          <p className="text-sm text-primary-200">Net Salary Payable</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(item.net_salary)}</p>
          <p className="text-xs text-primary-300 mt-0.5">Bahraini Dinar</p>
        </div>

        {/* Footer */}
        <p className="text-xs text-secondary-400 text-center mt-4">
          This is a computer-generated payslip and does not require a signature. · Generated on {formatDate(new Date())}
        </p>
      </div>
    </Modal>
  );
}
