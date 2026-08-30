import { useForm } from 'react-hook-form';
import { Modal } from '../../components/ui/Modal';
import { FormField, Input, Select, Textarea } from '../../components/ui/Form';
import { useCreateEmployee, useUpdateEmployee, useDepartments, usePositions } from '../../hooks/useEmployees';
import { useAuth } from '../../contexts/AuthContext';
import { useLookups, useEmployeeNumberConfig, generateEmployeeId } from '../../hooks/useSettings';
import {
  useEmployeeEducation, useCreateEducation, useUpdateEducation, useDeleteEducation,
  useEmployeeWorkHistory, useCreateWorkHistory, useUpdateWorkHistory, useDeleteWorkHistory,
  useEmployeeDependents, useCreateDependent, useUpdateDependent, useDeleteDependent,
} from '../../hooks/useEmployeeDetails';
import { useCustomFields, useEmployeeCustomValues, useSaveCustomValues, useSensitiveFieldFlags, useRevealFieldValue } from '../../hooks/useCustomFields';
import { useCountryConfig } from '../../hooks/useCountryConfig';
import { useAddressFormat, useEmployeeAddress, useSaveEmployeeAddress, renderAddressLine } from '../../hooks/useAddressFormat';
import AddressBlock from '../../components/employees/AddressBlock';
import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, GraduationCap, Briefcase, Users } from 'lucide-react';
import { formatDate, formatCurrency } from '../../lib/calculations';
import { ConfirmModal } from '../../components/ui/Modal';
import ImageUploadCrop from '../../components/ui/ImageUploadCrop';

const BASE_TABS = ['Personal', 'Employment', 'Salary', 'Education', 'Work History', 'Dependents', 'Documents', 'Banking'];

export default function EmployeeForm({ employee, onClose }) {
  const { companyId, company } = useAuth();
  const countryCode = company?.country_code || 'BH';
  // National ID + employee UI behavior comes from the country configuration
  const { config } = useCountryConfig();
  const employeeUi = config.raw?.employee_ui || {};
  const nationalId = {
    label: config.identity.nationalIdLabel,
    expiryLabel: employeeUi.national_id_expiry_label || `${config.identity.nationalIdLabel} Expiry`,
    placeholder: employeeUi.national_id_placeholder || '',
    required: employeeUi.national_id_required ?? false,
    hasExpiry: employeeUi.national_id_has_expiry ?? true,
    validation: config.identity.nationalIdValidation,
  };
  const showImmigration = employeeUi.show_immigration ?? true;
  const [tab, setTab] = useState('Personal');
  const [profilePhoto, setProfilePhoto] = useState(employee?.profile_photo || '');
  const { data: departments = [] } = useDepartments(companyId);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: employee || { employment_type: 'Full-Time', status: 'Active', gender: 'Male', basic_salary: 0, housing_allowance: 0, transport_allowance: 0, food_allowance: 0, other_allowances: 0 },
  });
  const deptId = watch('department_id');
  const { data: positions = [] } = usePositions(deptId, companyId);
  const { data: nationalities = [] } = useLookups('nationality', companyId);
  const { data: countries = [] } = useLookups('country', companyId);
  const { data: empNumConfig } = useEmployeeNumberConfig(companyId);
  const createEmployee = useCreateEmployee(companyId);
  const updateEmployee = useUpdateEmployee();
  const isEdit = !!employee;

  // Custom fields for employees module
  const { data: customFields = [] } = useCustomFields('employees', companyId, countryCode);
  const { data: customValues = {} } = useEmployeeCustomValues(isEdit ? employee.id : null);
  const saveCustomValues = useSaveCustomValues(companyId);

  // Custom field state (controlled separately from main form)
  const [customFieldValues, setCustomFieldValues] = useState({});

  // Pre-fill default values for new employees once field definitions load
  useEffect(() => {
    if (isEdit || customFields.length === 0) return;
    setCustomFieldValues(prev => {
      const next = { ...prev };
      for (const f of customFields) {
        if (f.default_value != null && next[f.id] === undefined) next[f.id] = f.default_value;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customFields.length, isEdit]);

  // Group visible custom fields by section
  const visibleFields = customFields.filter(f => f.is_visible !== false);
  const customFieldsBySection = visibleFields.reduce((acc, f) => {
    (acc[f.section] = acc[f.section] || []).push(f);
    return acc;
  }, {});
  // Sections beyond the built-in tabs get their own "Statutory" tab
  const extraSections = Object.keys(customFieldsBySection).filter(
    s => !['Personal', 'Documents'].includes(s)
  );
  const TABS = extraSections.length > 0
    ? [...BASE_TABS.slice(0, 2), 'Statutory', ...BASE_TABS.slice(2)]
    : BASE_TABS;

  // Structured country-specific address
  const { data: addressFormat } = useAddressFormat(countryCode, companyId);
  const { data: savedAddress } = useEmployeeAddress(isEdit ? employee.id : null);
  const [addressData, setAddressData] = useState({});
  const saveAddress = useSaveEmployeeAddress(companyId);
  useEffect(() => {
    if (savedAddress?.address_data) setAddressData(savedAddress.address_data);
  }, [savedAddress]);

  async function onSubmit(data) {
    if (!data.employee_id) {
      data.employee_id = generateEmployeeId(empNumConfig, empNumConfig?.starting_number || Date.now() % 10000);
    }
    // Coerce empty date strings to null — Postgres rejects ""
    const DATE_FIELDS = [
      'date_of_birth', 'joining_date', 'confirmation_date', 'termination_date',
      'cpr_expiry', 'passport_expiry', 'visa_expiry', 'work_permit_expiry',
    ];
    for (const f of DATE_FIELDS) {
      if (data[f] === '' || data[f] === undefined) data[f] = null;
    }
    // Coerce empty UUID fields to null
    const UUID_FIELDS = ['department_id', 'position_id', 'manager_id'];
    for (const f of UUID_FIELDS) {
      if (data[f] === '' || data[f] === undefined) data[f] = null;
    }
    // Coerce empty enum/text fields with constraints to null
    const NULLABLE_TEXT_FIELDS = ['marital_status', 'gender', 'religion', 'employment_type', 'visa_type'];
    for (const f of NULLABLE_TEXT_FIELDS) {
      if (data[f] === '' || data[f] === undefined) data[f] = null;
    }
    try {
      // Keep the legacy one-line address in sync with the structured address
      const hasStructuredAddress = addressFormat && Object.values(addressData).some(v => v);
      if (hasStructuredAddress) {
        data.address = renderAddressLine(addressFormat.display_template, addressData) || data.address;
      }
      let savedId = employee?.id;
      if (isEdit) {
        await updateEmployee.mutateAsync({ id: employee.id, ...data, profile_photo: profilePhoto || null });
      } else {
        const result = await createEmployee.mutateAsync({ ...data, profile_photo: profilePhoto || null });
        savedId = result?.id;
      }
      // Save custom field values
      if (savedId && Object.keys(customFieldValues).length > 0) {
        await saveCustomValues.mutateAsync({ employeeId: savedId, values: customFieldValues });
      }
      // Save structured address
      if (savedId && hasStructuredAddress) {
        await saveAddress.mutateAsync({ employeeId: savedId, countryCode, addressData });
      }
      onClose();
    } catch (e) { alert(e.message); }
  }

  const loading = createEmployee.isPending || updateEmployee.isPending;

  return (
    <Modal isOpen onClose={onClose} title={isEdit ? 'Edit Employee' : 'Add Employee'} size="xl"
      footer={
        <div className="flex justify-between items-center">
          <p className="text-xs text-secondary-400">Fields marked * are required</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit(onSubmit)} disabled={loading} className="btn-primary">
              {loading ? 'Saving...' : isEdit ? 'Update Employee' : 'Add Employee'}
            </button>
          </div>
        </div>
      }>
      <div className="flex gap-1 mb-6 border-b border-secondary-200 -mx-6 px-6 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-secondary-500 hover:text-secondary-700'}`}>
            {t}
          </button>
        ))}
      </div>

      <form className="space-y-4">
        {tab === 'Personal' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Profile photo */}
            <div className="sm:col-span-2 flex items-center gap-5 pb-4 border-b border-secondary-100">
              <ImageUploadCrop
                value={profilePhoto}
                onChange={url => setProfilePhoto(url)}
                bucket="employee-photos"
                storagePath={`${companyId}`}
                aspect={1}
                shape="round"
                label="Upload Photo"
                previewClass="w-20 h-20"
              />
              <div>
                <p className="text-sm font-medium text-secondary-700">Profile Photo</p>
                <p className="text-xs text-secondary-400 mt-0.5">Click to upload. You can crop after selecting.</p>
                {profilePhoto && (
                  <button type="button" onClick={() => setProfilePhoto('')}
                    className="text-xs text-error-500 hover:text-error-700 mt-1 transition-colors">
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <FormField label="First Name" required error={errors.first_name?.message}><Input {...register('first_name', { required: 'Required' })} placeholder="John" error={errors.first_name} /></FormField>
            <FormField label="Last Name" required error={errors.last_name?.message}><Input {...register('last_name', { required: 'Required' })} placeholder="Doe" error={errors.last_name} /></FormField>
            <FormField label="Arabic Name"><Input {...register('arabic_name')} placeholder="الاسم بالعربي" dir="rtl" /></FormField>
            <FormField label="Employee ID" hint="Auto-generated if blank"><Input {...register('employee_id')} placeholder={generateEmployeeId(empNumConfig)} /></FormField>
            <FormField label="Gender"><Select {...register('gender')}><option value="Male">Male</option><option value="Female">Female</option></Select></FormField>
            <FormField label="Date of Birth"><Input {...register('date_of_birth')} type="date" /></FormField>
            <FormField label="Nationality">
              <Select {...register('nationality')}>
                <option value="">Select nationality...</option>
                {nationalities.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Marital Status"><Select {...register('marital_status')}><option value="">Select...</option>{['Single','Married','Divorced','Widowed'].map(v=><option key={v}>{v}</option>)}</Select></FormField>
            <FormField label="Personal Email"><Input {...register('personal_email')} type="email" placeholder="john@email.com" /></FormField>
            <FormField label="Work Email"><Input {...register('work_email')} type="email" placeholder="john@company.com" /></FormField>
            <FormField label="Mobile"><Input {...register('mobile')} placeholder="+973 XXXX XXXX" /></FormField>
            <FormField label="Phone"><Input {...register('phone')} placeholder="+973 XXXX XXXX" /></FormField>
            {/* Country-specific structured address, falling back to free text */}
            {addressFormat ? (
              <>
                <div className="sm:col-span-2 border-t border-secondary-100 pt-4">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-1">Address</p>
                </div>
                <AddressBlock format={addressFormat} value={addressData} onChange={setAddressData} />
              </>
            ) : (
              <FormField label="Address" className="sm:col-span-2"><Textarea {...register('address')} rows={2} /></FormField>
            )}

            {/* Country-specific National ID — mandatory for GCC */}
            <div className="sm:col-span-2 border-t border-secondary-100 pt-4">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-3">National Identification</p>
            </div>
            <FormField label={nationalId.label} required={nationalId.required} error={errors.cpr_number?.message}>
              <Input
                {...register('cpr_number', {
                  ...(nationalId.required ? { required: `${nationalId.label} is required` } : {}),
                  ...(nationalId.validation
                    ? { pattern: { value: new RegExp(nationalId.validation), message: `Invalid ${nationalId.label} format` } }
                    : {}),
                })}
                placeholder={nationalId.placeholder}
                error={errors.cpr_number}
              />
            </FormField>
            {nationalId.hasExpiry && (
              <FormField label={nationalId.expiryLabel} required={nationalId.required} error={errors.cpr_expiry?.message}>
                <Input
                  {...register('cpr_expiry', nationalId.required ? { required: `${nationalId.expiryLabel} is required` } : {})}
                  type="date"
                  error={errors.cpr_expiry}
                />
              </FormField>
            )}
            {/* Dynamic custom fields for Personal section */}
            <CustomFieldsSection
              fields={customFieldsBySection['Personal'] || []}
              allFields={visibleFields}
              values={isEdit ? { ...customValues, ...customFieldValues } : customFieldValues}
              onChange={(fieldId, val) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: val }))}
              employeeId={isEdit ? employee.id : null} />
          </div>
        )}
        {tab === 'Statutory' && (
          <div className="space-y-6">
            {extraSections.sort().map(section => (
              <div key={section}>
                <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-3">
                  {section} — {config.countryName}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <CustomFieldsSection
                    fields={customFieldsBySection[section] || []}
                    allFields={visibleFields}
                    values={isEdit ? { ...customValues, ...customFieldValues } : customFieldValues}
                    onChange={(fieldId, val) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: val }))}
                    employeeId={isEdit ? employee.id : null} />
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'Employment' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department"><Select {...register('department_id')}><option value="">Select...</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</Select></FormField>
            <FormField label="Position"><Select {...register('position_id')}><option value="">Select...</option>{positions.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</Select></FormField>
            <FormField label="Employment Type"><Select {...register('employment_type')}>{['Full-Time','Part-Time','Contract','Probation'].map(v=><option key={v}>{v}</option>)}</Select></FormField>
            <FormField label="Status"><Select {...register('status')}>{['Active','Inactive','On Leave','Terminated','Resigned'].map(v=><option key={v}>{v}</option>)}</Select></FormField>
            <FormField label="Joining Date" required error={errors.joining_date?.message}><Input {...register('joining_date',{required:'Required'})} type="date" error={errors.joining_date} /></FormField>
            <FormField label="Confirmation Date"><Input {...register('confirmation_date')} type="date" /></FormField>
            <FormField label="Termination Date"><Input {...register('termination_date')} type="date" /></FormField>
            <FormField label="Termination Reason"><Input {...register('termination_reason')} /></FormField>
            <FormField label="Notes" className="sm:col-span-2"><Textarea {...register('notes')} rows={3} /></FormField>
          </div>
        )}
        {tab === 'Salary' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(() => {
              const ccy = config.locale.currencyCode;
              const dec = config.locale.currencyDecimals;
              const step = (1 / Math.pow(10, dec)).toFixed(dec);
              const gross = (+watch('basic_salary')||0)+(+watch('housing_allowance')||0)+(+watch('transport_allowance')||0)+(+watch('food_allowance')||0)+(+watch('other_allowances')||0);
              return (
                <>
                  <FormField label={`Basic Salary (${ccy})`} required><Input {...register('basic_salary',{valueAsNumber:true})} type="number" step={step} min="0" placeholder={step.replace(/1$/, '0')} /></FormField>
                  <FormField label={`Housing Allowance (${ccy})`}><Input {...register('housing_allowance',{valueAsNumber:true})} type="number" step={step} min="0" /></FormField>
                  <FormField label={`Transport Allowance (${ccy})`}><Input {...register('transport_allowance',{valueAsNumber:true})} type="number" step={step} min="0" /></FormField>
                  <FormField label={`Food Allowance (${ccy})`}><Input {...register('food_allowance',{valueAsNumber:true})} type="number" step={step} min="0" /></FormField>
                  <FormField label={`Other Allowances (${ccy})`}><Input {...register('other_allowances',{valueAsNumber:true})} type="number" step={step} min="0" /></FormField>
                  <div className="sm:col-span-2 p-4 bg-primary-50 rounded-xl border border-primary-100">
                    <p className="text-xs font-semibold text-primary-700 mb-1">Gross Salary Preview</p>
                    <p className="text-xl font-bold text-primary-900">{ccy} {gross.toFixed(dec)}</p>
                    {countryCode === 'BH' && config.flags.socialInsurance && (
                      <p className="text-xs text-primary-600 mt-1">GOSI (7% basic, Bahraini nationals): {ccy} {((+watch('basic_salary')||0)*0.07).toFixed(dec)}</p>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
        {tab === 'Documents' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <p className="text-xs text-secondary-400 bg-secondary-50 border border-secondary-200 rounded-lg px-3 py-2">
                National ID ({nationalId.label}) is managed in the <strong>Personal</strong> tab.
              </p>
            </div>
            <div className="sm:col-span-2 border-b border-secondary-100 pb-2">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Passport</p>
            </div>
            <FormField label="Passport Number"><Input {...register('passport_number')} /></FormField>
            <FormField label="Passport Expiry"><Input {...register('passport_expiry')} type="date" /></FormField>
            <FormField label="Passport Issue Country">
              <Select {...register('passport_issue_country')}>
                <option value="">Select country...</option>
                {countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </Select>
            </FormField>
            {showImmigration && (
              <>
                <div className="sm:col-span-2 border-b border-secondary-100 pb-2 pt-2">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Visa</p>
                </div>
                <FormField label="Visa Number"><Input {...register('visa_number')} /></FormField>
                <FormField label="Visa Expiry"><Input {...register('visa_expiry')} type="date" /></FormField>
                <FormField label="Visa Type"><Input {...register('visa_type')} placeholder="Work / Residence" /></FormField>
                <div className="sm:col-span-2 border-b border-secondary-100 pb-2 pt-2">
                  <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">Work Permit</p>
                </div>
                <FormField label="Work Permit Number"><Input {...register('work_permit_number')} /></FormField>
                <FormField label="Work Permit Expiry"><Input {...register('work_permit_expiry')} type="date" /></FormField>
              </>
            )}
            {/* Dynamic custom fields for Documents section */}
            <CustomFieldsSection
              fields={customFieldsBySection['Documents'] || []}
              allFields={visibleFields}
              values={isEdit ? { ...customValues, ...customFieldValues } : customFieldValues}
              onChange={(fieldId, val) => setCustomFieldValues(prev => ({ ...prev, [fieldId]: val }))}
              employeeId={isEdit ? employee.id : null} />
          </div>
        )}
        {tab === 'Banking' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Bank Name"><Input {...register('bank_name')} placeholder="Bank of Bahrain & Kuwait" /></FormField>
            <FormField label="Account Number"><Input {...register('bank_account')} /></FormField>
            <FormField label="IBAN" className="sm:col-span-2"><Input {...register('iban')} placeholder="BH00XXXX0000000000000000" /></FormField>
          </div>
        )}
      </form>

      {tab === 'Education' && (
        isEdit
          ? <EducationTab employeeId={employee.id} companyId={companyId} />
          : <SaveFirstPrompt tabName="Education" onSave={handleSubmit(onSubmit)} loading={loading} />
      )}
      {tab === 'Work History' && (
        isEdit
          ? <WorkHistoryTab employeeId={employee.id} companyId={companyId} />
          : <SaveFirstPrompt tabName="Work History" onSave={handleSubmit(onSubmit)} loading={loading} />
      )}
      {tab === 'Dependents' && (
        isEdit
          ? <DependentsTab employeeId={employee.id} companyId={companyId} countries={countries} />
          : <SaveFirstPrompt tabName="Dependents" onSave={handleSubmit(onSubmit)} loading={loading} />
      )}
    </Modal>
  );
}

// Evaluate a field's dependency_condition against current values.
// Condition: { field: <field_key>, operator: eq|neq|in, value }
function isDependencySatisfied(field, allFields, values) {
  const cond = field.dependency_condition;
  if (!cond?.field) return true;
  const target = (allFields || []).find(f => f.field_key === cond.field);
  const current = target ? values[target.id] ?? target.default_value ?? '' : '';
  switch (cond.operator) {
    case 'neq': return current !== cond.value;
    case 'in': return Array.isArray(cond.value) && cond.value.includes(current);
    case 'eq':
    default: return current === cond.value;
  }
}

// Renders dynamic custom fields for a given section
function CustomFieldsSection({ fields, allFields, values, onChange, employeeId }) {
  if (!fields || fields.length === 0) return null;
  const sensitiveIds = fields.filter(f => f.is_sensitive).map(f => f.id);
  const { data: sensitiveFlags = {} } = useSensitiveFieldFlags(sensitiveIds.length > 0 ? employeeId : null);
  return (
    <>
      {fields
        .filter(f => isDependencySatisfied(f, allFields ?? fields, values))
        .map(f => (
          <FormField key={f.id} label={f.field_label} required={f.is_required} hint={f.hint}>
            {f.is_sensitive ? (
              <SensitiveFieldInput
                field={f}
                employeeId={employeeId}
                hasStoredValue={!!sensitiveFlags[f.id]}
                value={values[f.id] ?? ''}
                onChange={val => onChange(f.id, val)} />
            ) : (
              <CustomFieldInput
                field={f}
                value={values[f.id] ?? ''}
                onChange={val => onChange(f.id, val)} />
            )}
          </FormField>
        ))}
    </>
  );
}

// A field flagged is_sensitive (e.g. PAN) is encrypted at rest and its
// plaintext is never included in the normal read — this renders a masked
// placeholder with an explicit, permission-gated, audited "Reveal"
// instead, or a plain input once the user starts typing a replacement.
function SensitiveFieldInput({ field, employeeId, hasStoredValue, value, onChange }) {
  const [revealed, setRevealed] = useState(null); // null = not revealed; string = decrypted value shown
  const [editing, setEditing] = useState(false);
  const reveal = useRevealFieldValue();

  if (value || editing || !hasStoredValue) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        required={field.is_required}
        pattern={field.validation_rule?.regex}
        className="input" />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input type="text" readOnly value={revealed ?? '••••••••••'} className="input bg-secondary-50 text-secondary-500 tracking-widest" />
      {revealed === null ? (
        <button type="button" disabled={reveal.isPending}
          onClick={async () => {
            try {
              const val = await reveal.mutateAsync({ employeeId, fieldKey: field.field_key });
              setRevealed(val || '(not set)');
            } catch (e) { alert(e.message); }
          }}
          className="btn-secondary text-xs whitespace-nowrap">
          {reveal.isPending ? 'Revealing…' : 'Reveal'}
        </button>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary text-xs whitespace-nowrap">
          Replace
        </button>
      )}
    </div>
  );
}

function CustomFieldInput({ field, value, onChange }) {
  switch (field.field_type) {
    case 'select': {
      const opts = Array.isArray(field.options) ? field.options : [];
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          className="input">
          <option value="">{field.placeholder || 'Select...'}</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    case 'textarea':
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          rows={3}
          className="input" />
      );
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={value === 'true' || value === true}
            onChange={e => onChange(e.target.checked ? 'true' : 'false')}
            className="rounded" />
          {field.field_label}
        </label>
      );
    default:
      return (
        <input
          type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          required={field.is_required}
          pattern={field.validation_rule?.regex}
          min={field.validation_rule?.min}
          max={field.validation_rule?.max}
          title={field.validation_rule?.regex ? `${field.field_label}: expected format ${field.validation_rule.regex}` : undefined}
          className="input" />
      );
  }
}

function SaveFirstPrompt({ tabName, onSave, loading }) {
  return (
    <div className="text-center py-8 space-y-3">
      <p className="text-secondary-500 text-sm">Save the employee first to add {tabName} records.</p>
      <button onClick={onSave} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save Employee'}</button>
    </div>
  );
}

function EducationTab({ employeeId, companyId }) {
  const { data: records = [], isLoading } = useEmployeeEducation(employeeId, companyId);
  const { data: qualTypes = [] } = useLookups('qualification_type', companyId);
  const { data: countries = [] } = useLookups('country', companyId);
  const createEdu = useCreateEducation(companyId);
  const updateEdu = useUpdateEducation();
  const deleteEdu = useDeleteEducation();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm"><Plus className="w-3.5 h-3.5" /> Add Education</button>
      </div>
      {isLoading ? <p className="text-sm text-secondary-400">Loading...</p> : records.length === 0 ? (
        <div className="text-center py-8 text-secondary-400 text-sm">No education records.</div>
      ) : records.map(r => (
        <div key={r.id} className="p-4 border border-secondary-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-secondary-800 text-sm">{r.qualification_type || '–'}</p>
              <p className="text-sm text-secondary-600">{r.institution_name}{r.field_of_study ? ` · ${r.field_of_study}` : ''}</p>
              <p className="text-xs text-secondary-400">{[r.country, r.year_completed, r.grade ? `Grade: ${r.grade}` : ''].filter(Boolean).join(' · ')}</p>
              {r.is_verified && <span className="text-xs text-success-600 font-semibold">✓ Verified</span>}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeletingId(r.id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {showForm && <EduForm editing={editing} qualTypes={qualTypes} countries={countries}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={async d => { if (editing) await updateEdu.mutateAsync({ id: editing.id, ...d }); else await createEdu.mutateAsync({ ...d, employee_id: employeeId }); }} />}
      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={async () => { await deleteEdu.mutateAsync(deletingId); setDeletingId(null); }} title="Delete Education" message="Remove this record?" />
    </div>
  );
}

function EduForm({ editing, qualTypes, countries, onClose, onSave }) {
  const { register, handleSubmit } = useForm({ defaultValues: editing || {} });
  const [loading, setLoading] = useState(false);
  async function submit(d) { setLoading(true); try { await onSave(d); onClose(); } catch(e){ alert(e.message); } finally { setLoading(false); }}
  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit Education' : 'Add Education'} size="md"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSubmit(submit)} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save'}</button></div>}>
      <form className="grid grid-cols-2 gap-4">
        <FormField label="Qualification Type" className="col-span-2">
          <Select {...register('qualification_type')}>
            <option value="">Select...</option>
            {qualTypes.length > 0 ? qualTypes.map(q => <option key={q.id} value={q.name}>{q.name}</option>) : ['High School','Diploma','Bachelor','Master','PhD','Professional Cert','Other'].map(v => <option key={v}>{v}</option>)}
          </Select>
        </FormField>
        <FormField label="Institution Name" className="col-span-2"><Input {...register('institution_name')} /></FormField>
        <FormField label="Field of Study"><Input {...register('field_of_study')} /></FormField>
        <FormField label="Grade / GPA"><Input {...register('grade')} placeholder="e.g. 3.8, Distinction" /></FormField>
        <FormField label="Year Completed"><Input {...register('year_completed', { valueAsNumber: true })} type="number" placeholder="2020" /></FormField>
        <FormField label="Country"><Select {...register('country')}><option value="">Select...</option>{countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</Select></FormField>
        <FormField label="Verified"><Select {...register('is_verified', { setValueAs: v => v === 'true' || v === true })}><option value="false">No</option><option value="true">Yes</option></Select></FormField>
        <FormField label="Notes" className="col-span-2"><Textarea {...register('notes')} rows={2} /></FormField>
      </form>
    </Modal>
  );
}

function WorkHistoryTab({ employeeId, companyId }) {
  const { data: records = [], isLoading } = useEmployeeWorkHistory(employeeId, companyId);
  const { data: countries = [] } = useLookups('country', companyId);
  const create = useCreateWorkHistory(companyId);
  const update = useUpdateWorkHistory();
  const remove = useDeleteWorkHistory();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm"><Plus className="w-3.5 h-3.5" /> Add Work History</button>
      </div>
      {isLoading ? <p className="text-sm text-secondary-400">Loading...</p> : records.length === 0 ? (
        <div className="text-center py-8 text-secondary-400 text-sm">No previous employment records.</div>
      ) : records.map(r => (
        <div key={r.id} className="p-4 border border-secondary-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-accent-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-secondary-800 text-sm">{r.position || '–'} at {r.employer_name}</p>
              <p className="text-xs text-secondary-500">{formatDate(r.start_date)} – {r.end_date ? formatDate(r.end_date) : 'Present'}{r.country ? ` · ${r.country}` : ''}</p>
              {r.last_salary > 0 && <p className="text-xs text-secondary-400">Last Salary: {formatCurrency(r.last_salary)}</p>}
              {r.reason_for_leaving && <p className="text-xs text-secondary-400">Left: {r.reason_for_leaving}</p>}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeletingId(r.id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {showForm && <WorkHistoryForm editing={editing} countries={countries}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={async d => { if (editing) await update.mutateAsync({ id: editing.id, ...d }); else await create.mutateAsync({ ...d, employee_id: employeeId }); }} />}
      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={async () => { await remove.mutateAsync(deletingId); setDeletingId(null); }} title="Delete Work History" message="Remove this record?" />
    </div>
  );
}

function WorkHistoryForm({ editing, countries, onClose, onSave }) {
  const { register, handleSubmit } = useForm({ defaultValues: editing || {} });
  const [loading, setLoading] = useState(false);
  async function submit(d) { setLoading(true); try { await onSave(d); onClose(); } catch(e){ alert(e.message); } finally { setLoading(false); }}
  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit Work History' : 'Add Work History'} size="md"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSubmit(submit)} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save'}</button></div>}>
      <form className="grid grid-cols-2 gap-4">
        <FormField label="Employer Name" required className="col-span-2"><Input {...register('employer_name', { required: true })} /></FormField>
        <FormField label="Position"><Input {...register('position')} /></FormField>
        <FormField label="Department"><Input {...register('department')} /></FormField>
        <FormField label="Start Date"><Input {...register('start_date')} type="date" /></FormField>
        <FormField label="End Date"><Input {...register('end_date')} type="date" /></FormField>
        <FormField label="Country"><Select {...register('country')}><option value="">Select...</option>{countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</Select></FormField>
        <FormField label="Last Salary"><Input {...register('last_salary', { valueAsNumber: true })} type="number" step="0.001" /></FormField>
        <FormField label="Reason for Leaving" className="col-span-2"><Input {...register('reason_for_leaving')} /></FormField>
        <FormField label="Reference Name"><Input {...register('reference_name')} /></FormField>
        <FormField label="Reference Contact"><Input {...register('reference_contact')} /></FormField>
      </form>
    </Modal>
  );
}

function DependentsTab({ employeeId, companyId, countries }) {
  const { data: records = [], isLoading } = useEmployeeDependents(employeeId, companyId);
  const { data: nationalities = [] } = useLookups('nationality', companyId);
  const { data: qualTypes = [] } = useLookups('qualification_type', companyId);
  const create = useCreateDependent(companyId);
  const update = useUpdateDependent();
  const remove = useDeleteDependent();
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary text-sm"><Plus className="w-3.5 h-3.5" /> Add Dependent</button>
      </div>
      {isLoading ? <p className="text-sm text-secondary-400">Loading...</p> : records.length === 0 ? (
        <div className="text-center py-8 text-secondary-400 text-sm">No dependents recorded.</div>
      ) : records.map(r => (
        <div key={r.id} className="p-4 border border-secondary-200 rounded-xl flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-warning-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-secondary-800 text-sm">{r.full_name} <span className="font-normal text-secondary-400">({r.relationship})</span></p>
              <p className="text-xs text-secondary-500">{r.nationality}{r.date_of_birth ? ` · DOB: ${formatDate(r.date_of_birth)}` : ''}</p>
              <div className="flex gap-3 mt-1 flex-wrap">
                {r.passport_number && <span className="text-xs text-secondary-400">Passport: {r.passport_number}{r.passport_expiry ? ` (exp. ${formatDate(r.passport_expiry)})` : ''}</span>}
                {r.cpr_number && <span className="text-xs text-secondary-400">National ID: {r.cpr_number}{r.cpr_expiry ? ` (exp. ${formatDate(r.cpr_expiry)})` : ''}</span>}
                {r.qualification && <span className="text-xs text-secondary-400">Qual: {r.qualification}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 hover:bg-secondary-100 rounded text-secondary-400 hover:text-primary-600"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => setDeletingId(r.id)} className="p-1.5 hover:bg-error-50 rounded text-secondary-400 hover:text-error-600"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {showForm && <DependentForm editing={editing} countries={countries} nationalities={nationalities} qualTypes={qualTypes}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSave={async d => { if (editing) await update.mutateAsync({ id: editing.id, ...d }); else await create.mutateAsync({ ...d, employee_id: employeeId }); }} />}
      <ConfirmModal isOpen={!!deletingId} onClose={() => setDeletingId(null)} onConfirm={async () => { await remove.mutateAsync(deletingId); setDeletingId(null); }} title="Delete Dependent" message="Remove this dependent?" />
    </div>
  );
}

function DependentForm({ editing, countries, nationalities, qualTypes, onClose, onSave }) {
  const { register, handleSubmit } = useForm({ defaultValues: editing || {} });
  const [loading, setLoading] = useState(false);
  async function submit(d) { setLoading(true); try { await onSave(d); onClose(); } catch(e){ alert(e.message); } finally { setLoading(false); }}
  return (
    <Modal isOpen onClose={onClose} title={editing ? 'Edit Dependent' : 'Add Dependent'} size="lg"
      footer={<div className="flex justify-end gap-2"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={handleSubmit(submit)} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save'}</button></div>}>
      <form className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Full Name" required className="col-span-2"><Input {...register('full_name', { required: true })} /></FormField>
          <FormField label="Relationship">
            <Select {...register('relationship')}>
              <option value="">Select...</option>
              {['Spouse','Son','Daughter','Father','Mother','Brother','Sister','Other'].map(v => <option key={v}>{v}</option>)}
            </Select>
          </FormField>
          <FormField label="Gender"><Select {...register('gender')}><option value="">Select...</option><option>Male</option><option>Female</option></Select></FormField>
          <FormField label="Date of Birth"><Input {...register('date_of_birth')} type="date" /></FormField>
          <FormField label="Nationality"><Select {...register('nationality')}><option value="">Select...</option>{nationalities.map(n => <option key={n.id} value={n.name}>{n.name}</option>)}</Select></FormField>
        </div>
        <div className="border-t border-secondary-100 pt-4">
          <p className="text-xs font-semibold text-secondary-500 uppercase mb-3">Passport</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Passport Number"><Input {...register('passport_number')} /></FormField>
            <FormField label="Passport Expiry"><Input {...register('passport_expiry')} type="date" /></FormField>
            <FormField label="Issue Country" className="col-span-2"><Select {...register('passport_issue_country')}><option value="">Select...</option>{countries.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</Select></FormField>
          </div>
        </div>
        <div className="border-t border-secondary-100 pt-4">
          <p className="text-xs font-semibold text-secondary-500 uppercase mb-3">National ID</p>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="National ID Number"><Input {...register('cpr_number')} placeholder="XXXXXXXXX" /></FormField>
            <FormField label="National ID Expiry"><Input {...register('cpr_expiry')} type="date" /></FormField>
          </div>
        </div>
        <div className="border-t border-secondary-100 pt-4">
          <p className="text-xs font-semibold text-secondary-500 uppercase mb-3">Qualification</p>
          <FormField label="Highest Qualification">
            <Select {...register('qualification')}>
              <option value="">Select...</option>
              {qualTypes.length > 0 ? qualTypes.map(q => <option key={q.id} value={q.name}>{q.name}</option>) : ['None','Primary','High School','Diploma','Bachelor','Master','PhD','Other'].map(v => <option key={v}>{v}</option>)}
            </Select>
          </FormField>
          <FormField label="Notes" className="mt-3"><Textarea {...register('notes')} rows={2} /></FormField>
        </div>
      </form>
    </Modal>
  );
}
