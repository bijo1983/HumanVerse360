import { forwardRef } from 'react';

export const FormField = forwardRef(({ label, error, required, hint, children, className = '' }, _ref) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && (
      <label className="label">
        {label}{required && <span className="text-error-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="text-xs text-secondary-400">{hint}</p>}
    {error && <p className="text-xs text-error-600 font-medium">{error}</p>}
  </div>
));
FormField.displayName = 'FormField';

export const Input = forwardRef(({ error, className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`input ${error ? 'border-error-300 focus:ring-error-500' : ''} ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';

export const Select = forwardRef(({ error, children, className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`input ${error ? 'border-error-300 focus:ring-error-500' : ''} ${className}`}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export const Textarea = forwardRef(({ error, rows = 3, className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    rows={rows}
    className={`input resize-none ${error ? 'border-error-300 focus:ring-error-500' : ''} ${className}`}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function SearchInput({ value, onChange, placeholder = 'Search...', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9"
      />
    </div>
  );
}
