import * as React from "react"
import { Label } from "./Label"
import { cn } from "@/lib/utils"
import { dsSelectClass, dsFieldErrorClass, dsFieldLabelClass, dsFieldHintClass, dsFieldErrorTextClass } from "./field-styles"

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  children: React.ReactNode
}

function makeSelectId(id: string | undefined, label: string | undefined) {
  return id || label?.toLowerCase().replace(/\s+/g, "-")
}

function FieldHelp({
  error,
  hint,
}: {
  error?: string
  hint?: string
}) {
  if (error) {
    return <p className={dsFieldErrorTextClass}>{error}</p>
  }

  if (hint) {
    return <p className={dsFieldHintClass}>{hint}</p>
  }

  return null
}

export default function FormSelect({
  label,
  error,
  hint,
  className = "",
  id,
  children,
  ...props
}: FormSelectProps) {
  const selectId = makeSelectId(id, label)

  return (
    <div className="w-full" data-autonnel-ui="form-select">
      {label && (
        <Label htmlFor={selectId} className={dsFieldLabelClass}>
          {label}
        </Label>
      )}
      <select
        id={selectId}
        className={cn(dsSelectClass, error && dsFieldErrorClass, className)}
        data-autonnel-ui="form-select-control"
        {...props}
      >
        {children}
      </select>
      <FieldHelp error={error} hint={hint} />
    </div>
  )
}


export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./Select"
