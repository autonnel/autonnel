import * as React from "react"
import { Textarea } from "./Textarea"
import { Label } from "./Label"
import { cn } from "@/lib/utils"
import { dsFieldErrorClass, dsFieldLabelClass, dsFieldHintClass, dsFieldErrorTextClass } from "./field-styles"

interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
}

function getTextareaId(id: string | undefined, label: string | undefined) {
  return id || label?.toLowerCase().replace(/\s+/g, "-")
}

function TextareaHelp({ error, hint }: { error?: string; hint?: string }) {
  if (error) {
    return <p className={dsFieldErrorTextClass}>{error}</p>
  }

  if (hint) {
    return <p className={dsFieldHintClass}>{hint}</p>
  }

  return null
}

export default function FormTextarea({
  label,
  error,
  hint,
  className = "",
  id,
  ...props
}: FormTextareaProps) {
  const textareaId = getTextareaId(id, label)

  return (
    <div className="w-full" data-autonnel-ui="form-textarea">
      {label && (
        <Label htmlFor={textareaId} className={dsFieldLabelClass}>
          {label}
        </Label>
      )}
      <Textarea
        id={textareaId}
        className={cn(error && dsFieldErrorClass, className)}
        data-autonnel-ui="form-textarea-control"
        {...props}
      />
      <TextareaHelp error={error} hint={hint} />
    </div>
  )
}


export { Textarea }
