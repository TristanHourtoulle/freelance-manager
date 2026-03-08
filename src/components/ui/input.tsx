import { forwardRef, type InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/**
 * Labeled text input with inline validation error display.
 * Supports ref forwarding for integration with react-hook-form.
 *
 * @param label - Visible label text; also used to derive a default `id`
 * @param error - Validation error message shown below the input
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, type = "text", className = "", ...props },
  ref,
) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-")

  return (
    <div className="space-y-2">
      <label htmlFor={inputId}>{label}</label>
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`${error ? "border-destructive" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
})
