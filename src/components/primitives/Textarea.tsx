import * as React from "react";

import { cn } from "@/lib/utils";
import { dsTextareaClass } from "./field-styles";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...textareaProps }, ref) => (
    <textarea
      data-autonnel-ui="textarea"
      ref={ref}
      className={cn(dsTextareaClass, className)}
      {...textareaProps}
    />
  ),
);
Textarea.displayName = "AutonnelTextarea";

export { Textarea };
