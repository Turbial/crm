/**
 * A labelled select dropdown for filter bars.
 *
 * <SelectFilter
 *   value={status}
 *   onChange={setStatus}
 *   options={[
 *     { value: '', label: 'All statuses' },
 *     { value: 'open', label: 'Open' },
 *   ]}
 *   width={160}
 * />
 */
export default function SelectFilter({ value, onChange, options = [], width = 160, placeholder }) {
  return (
    <select
      className="form-input"
      style={{ width }}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label ?? o.value}</option>
      ))}
    </select>
  )
}
