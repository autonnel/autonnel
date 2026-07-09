import * as React from "react"
import { Input } from "./Input"
import { Label } from "./Label"
import { cn } from "@/lib/utils"
import { dsFieldErrorClass, dsFieldLabelClass, dsFieldHintClass, dsFieldErrorTextClass } from "./field-styles"

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

function getFieldId(id: string | undefined, label: string | undefined) {
  return id || label?.toLowerCase().replace(/\s+/g, "-")
}

function FormHelperText({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return <p className={dsFieldErrorTextClass}>{error}</p>
  }

  if (hint) {
    return <p className={dsFieldHintClass}>{hint}</p>
  }

  return null
}

export default function FormInput({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: FormInputProps) {
  const inputId = getFieldId(id, label)

  return (
    <div className="w-full" data-autonnel-ui="form-input">
      {label && (
        <Label htmlFor={inputId} className={dsFieldLabelClass}>
          {label}
        </Label>
      )}
      <Input
        id={inputId}
        className={cn(error && dsFieldErrorClass, className)}
        data-autonnel-ui="form-input-control"
        {...props}
      />
      <FormHelperText error={error} hint={hint} />
    </div>
  )
}


export { Input, Label }
