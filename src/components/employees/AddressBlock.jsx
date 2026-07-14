import { FormField, Input, Select } from '../ui/Form';

// Country-driven structured address section. `format` is a
// country_address_formats row; `value` is the address_data object.
export default function AddressBlock({ format, value = {}, onChange }) {
  const fields = Array.isArray(format?.fields) ? format.fields : [];
  if (fields.length === 0) return null;

  const ordered = [...fields].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  return (
    <>
      {ordered.map(f => {
        const isFull = f.width === 'full';
        const common = {
          value: value[f.key] ?? '',
          onChange: e => onChange({ ...value, [f.key]: e.target.value }),
          required: !!f.required,
          placeholder: f.placeholder || '',
        };
        return (
          <FormField key={f.key} label={f.label} required={!!f.required} className={isFull ? 'sm:col-span-2' : undefined}>
            {f.type === 'select' ? (
              <Select {...common}>
                <option value="">Select...</option>
                {(f.options || []).map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </Select>
            ) : (
              <Input
                {...common}
                pattern={f.validation?.regex}
                title={f.validation?.regex ? `Expected format: ${f.label}` : undefined}
              />
            )}
          </FormField>
        );
      })}
    </>
  );
}
