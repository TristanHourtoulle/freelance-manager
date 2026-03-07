import { forwardRef, type SelectHTMLAttributes } from "react"

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, error, options, placeholder, id, className = "", ...props },
    ref,
  ) {
    const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="space-y-2">
        <label htmlFor={selectId}>{label}</label>
        <select
          ref={ref}
          id={selectId}
          className={`${error ? "border-destructive" : ""} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  },
)
