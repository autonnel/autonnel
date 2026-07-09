import * as React from "react";

import { cn } from "@/lib/utils";
import { dsFieldClass } from "./field-styles";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...inputProps }, ref) => (
    <input
      data-autonnel-ui="input"
      ref={ref}
      type={type}
      className={cn(dsFieldClass, className)}
      {...inputProps}
    />
  ),
);
Input.displayName = "AutonnelInput";

export { Input };
