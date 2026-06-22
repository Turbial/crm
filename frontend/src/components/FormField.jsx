/**
 * Wrap any form control in a labelled field with consistent spacing and error display.
 *
 * Usage — custom child:
 *   <FormField label="Name" required error={errors.name}>
 *     <input className="form-input" … />
 *   </FormField>
 *
 * Usage — shorthand input:
 *   <FormField label="Name" required value={form.name} onChange={e => …} placeholder="Jane" />
 */
export default function FormField({
  label,
  required,
  error,
  hint,
  children,
  // shorthand props forwarded to <input> when no children provided
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
  disabled,
}) {
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {children ?? (
        <input
          className="form-input"
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
        />
      )}
      {hint && !error && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>}
      {error && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}
