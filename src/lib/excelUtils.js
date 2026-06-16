// ── Lazy-load SheetJS from CDN (avoids npm install requirement) ───────────────

let _xlsxPromise = null;

function loadXLSX() {
  if (_xlsxPromise) return _xlsxPromise;
  if (typeof window !== 'undefined' && window.XLSX) {
    _xlsxPromise = Promise.resolve(window.XLSX);
    return _xlsxPromise;
  }
  _xlsxPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error('Failed to load XLSX library'));
    document.head.appendChild(script);
  });
  return _xlsxPromise;
}

// ── Column definitions for employee import/export ────────────────────────────

export const EMPLOYEE_COLUMNS = [
  { key: 'employee_id',         label: 'Employee ID',           required: false },
  { key: 'first_name',          label: 'First Name',            required: true  },
  { key: 'last_name',           label: 'Last Name',             required: true  },
  { key: 'arabic_name',         label: 'Arabic Name',           required: false },
  { key: 'gender',              label: 'Gender',                required: false },
  { key: 'date_of_birth',       label: 'Date of Birth',         required: false },
  { key: 'nationality',         label: 'Nationality',           required: false },
  { key: 'marital_status',      label: 'Marital Status',        required: false },
  { key: 'personal_email',      label: 'Personal Email',        required: false },
  { key: 'work_email',          label: 'Work Email',            required: false },
  { key: 'mobile',              label: 'Mobile',                required: false },
  { key: 'phone',               label: 'Phone',                 required: false },
  { key: 'address',             label: 'Address',               required: false },
  { key: 'cpr_number',          label: 'CPR/National ID',       required: false },
  { key: 'cpr_expiry',          label: 'CPR/ID Expiry',         required: false },
  { key: 'passport_number',     label: 'Passport Number',       required: false },
  { key: 'passport_expiry',     label: 'Passport Expiry',       required: false },
  { key: 'passport_issue_country', label: 'Passport Country',  required: false },
  { key: 'visa_number',         label: 'Visa Number',           required: false },
  { key: 'visa_expiry',         label: 'Visa Expiry',           required: false },
  { key: 'visa_type',           label: 'Visa Type',             required: false },
  { key: 'work_permit_number',  label: 'Work Permit Number',    required: false },
  { key: 'work_permit_expiry',  label: 'Work Permit Expiry',    required: false },
  { key: 'joining_date',        label: 'Joining Date',          required: true  },
  { key: 'confirmation_date',   label: 'Confirmation Date',     required: false },
  { key: 'employment_type',     label: 'Employment Type',       required: false },
  { key: 'status',              label: 'Status',                required: false },
  { key: 'department_name',     label: 'Department',            required: false },
  { key: 'position_title',      label: 'Position',              required: false },
  { key: 'basic_salary',        label: 'Basic Salary',          required: false },
  { key: 'housing_allowance',   label: 'Housing Allowance',     required: false },
  { key: 'transport_allowance', label: 'Transport Allowance',   required: false },
  { key: 'food_allowance',      label: 'Food Allowance',        required: false },
  { key: 'other_allowances',    label: 'Other Allowances',      required: false },
  { key: 'bank_name',           label: 'Bank Name',             required: false },
  { key: 'bank_account',        label: 'Bank Account',          required: false },
  { key: 'iban',                label: 'IBAN',                  required: false },
  { key: 'notes',               label: 'Notes',                 required: false },
];

export const LEAVE_BALANCE_COLUMNS = [
  { key: 'employee_id', label: 'Employee ID', required: true  },
  { key: 'leave_code',  label: 'Leave Code',  required: true  },
  { key: 'entitled',    label: 'Entitled Days', required: true },
  { key: 'used',        label: 'Used Days',   required: false },
  { key: 'carried',     label: 'Carried Forward', required: false },
];

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportEmployeesToExcel(employees) {
  const XLSX = await loadXLSX();
  const headers = EMPLOYEE_COLUMNS.map(c => c.label);
  const rows = employees.map(emp =>
    EMPLOYEE_COLUMNS.map(c => {
      const v = emp[c.key];
      if (v === null || v === undefined) return '';
      if (typeof v === 'number') return v;
      return String(v);
    })
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = EMPLOYEE_COLUMNS.map(c => ({ wch: Math.max(c.label.length, 16) }));

  headers.forEach((_, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellRef]) return;
    ws[cellRef].s = { font: { bold: true }, fill: { fgColor: { rgb: '1e40af' }, patternType: 'solid' } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');

  const notesData = [
    ['Column', 'Required', 'Notes'],
    ...EMPLOYEE_COLUMNS.map(c => [c.label, c.required ? 'Yes' : 'No', getColumnNote(c.key)]),
  ];
  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Field Guide');

  XLSX.writeFile(wb, `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function downloadEmployeeTemplate() {
  const XLSX = await loadXLSX();
  const headers = EMPLOYEE_COLUMNS.map(c => c.label);
  const sampleRow = EMPLOYEE_COLUMNS.map(c => getSampleValue(c.key));

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws['!cols'] = EMPLOYEE_COLUMNS.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');

  const notesData = [
    ['Column', 'Required', 'Notes'],
    ...EMPLOYEE_COLUMNS.map(c => [c.label, c.required ? 'Yes' : 'No', getColumnNote(c.key)]),
  ];
  const wsNotes = XLSX.utils.aoa_to_sheet(notesData);
  wsNotes['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsNotes, 'Field Guide');

  XLSX.writeFile(wb, 'employee_import_template.xlsx');
}

export async function downloadLeaveBalanceTemplate(leaveTypes) {
  const XLSX = await loadXLSX();
  const headers = LEAVE_BALANCE_COLUMNS.map(c => c.label);
  const sampleRow = ['EMP001', leaveTypes[0]?.code || 'AL', 30, 0, 0];

  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leave Balances');

  const codesData = [
    ['Leave Code', 'Leave Type Name'],
    ...leaveTypes.map(t => [t.code, t.name]),
  ];
  const wsCodes = XLSX.utils.aoa_to_sheet(codesData);
  wsCodes['!cols'] = [{ wch: 14 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsCodes, 'Leave Codes');

  XLSX.writeFile(wb, 'leave_balance_import_template.xlsx');
}

// ── Parse imported file ───────────────────────────────────────────────────────

export function parseEmployeeImport(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const XLSX = await loadXLSX();
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

          const labelToKey = Object.fromEntries(EMPLOYEE_COLUMNS.map(c => [c.label.toLowerCase(), c.key]));

          const parsed = rows.map(row => {
            const emp = {};
            for (const [colName, value] of Object.entries(row)) {
              const key = labelToKey[colName.trim().toLowerCase()];
              if (key) emp[key] = value === '' ? null : value;
            }
            return emp;
          }).filter(emp => emp.first_name || emp.last_name);

          const missing = parsed.filter(e => !e.first_name || !e.last_name || !e.joining_date);
          if (missing.length > 0) {
            reject(new Error(`${missing.length} row(s) missing required fields (First Name, Last Name, Joining Date)`));
            return;
          }

          resolve(parsed);
        } catch (err) {
          reject(new Error('Failed to parse file: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(err);
    }
  });
}

export function parseLeaveBalanceImport(file) {
  return new Promise(async (resolve, reject) => {
    try {
      const XLSX = await loadXLSX();
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { raw: true });

          const parsed = rows.map(row => ({
            employee_id_str: String(row['Employee ID'] || '').trim(),
            leave_code: String(row['Leave Code'] || '').trim().toUpperCase(),
            entitled: parseFloat(row['Entitled Days']) || 0,
            used: parseFloat(row['Used Days']) || 0,
            carried: parseFloat(row['Carried Forward']) || 0,
          })).filter(r => r.employee_id_str && r.leave_code);

          resolve(parsed);
        } catch (err) {
          reject(new Error('Failed to parse file: ' + err.message));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    } catch (err) {
      reject(err);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSampleValue(key) {
  const samples = {
    first_name: 'John', last_name: 'Smith', arabic_name: 'جون', employee_id: '',
    gender: 'Male', date_of_birth: '1990-01-15', nationality: 'Bahraini',
    marital_status: 'Single', personal_email: 'john@email.com', work_email: 'john@company.com',
    mobile: '+97366001234', phone: '', address: 'Manama, Bahrain',
    cpr_number: '880112345', cpr_expiry: '2026-12-31',
    passport_number: 'A1234567', passport_expiry: '2030-06-01', passport_issue_country: 'Bahrain',
    visa_number: '', visa_expiry: '', visa_type: 'Work',
    work_permit_number: '', work_permit_expiry: '',
    joining_date: '2024-01-01', confirmation_date: '2024-04-01',
    employment_type: 'Full-Time', status: 'Active',
    department_name: 'Human Resources', position_title: 'HR Officer',
    basic_salary: 500, housing_allowance: 150, transport_allowance: 50,
    food_allowance: 0, other_allowances: 0,
    bank_name: 'BBK', bank_account: '12345678', iban: 'BH29BMAG1299123456BH00',
    notes: '',
  };
  return samples[key] ?? '';
}

function getColumnNote(key) {
  const notes = {
    employee_id: 'Leave blank to auto-generate',
    gender: 'Male or Female',
    date_of_birth: 'YYYY-MM-DD format',
    joining_date: 'YYYY-MM-DD format (required)',
    employment_type: 'Full-Time, Part-Time, Contract, or Probation',
    status: 'Active, Inactive, On Leave, Terminated, or Resigned',
    department_name: 'Must match existing department name',
    position_title: 'Must match existing position title',
    cpr_expiry: 'YYYY-MM-DD format',
    passport_expiry: 'YYYY-MM-DD format',
    basic_salary: 'Numeric value in BHD',
  };
  return notes[key] ?? '';
}
