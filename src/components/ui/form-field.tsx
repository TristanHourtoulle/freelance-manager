import { forwardRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FormFieldProps extends React.ComponentProps<typeof Input> {
  label?: string
  error?: string
}

/**
 * Wraps the shadcn Input with an optional label and error message.
 * Drop-in replacement for the old Input that accepted `label` and `error` props.
 */
const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const fieldId = id || props.name
    return (
      <div className={cn("space-y-1.5", className)}>
        {label && <Label htmlFor={fieldId}>{label}</Label>}
        <Input id={fieldId} ref={ref} aria-invalid={!!error} {...props} />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  },
)
FormField.displayName = "FormField"

export { FormField }
