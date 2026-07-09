import * as React from "react";

import { cn } from "@/lib/utils";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <input
      data-autonnel-ui="checkbox"
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded-[4px] cursor-pointer accent-ds-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/30 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Checkbox.displayName = "AutonnelCheckbox";

export { Checkbox };
