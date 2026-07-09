import * as React from "react";

import { cn } from "@/lib/utils";

export interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Radio = React.forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => (
    <input
      data-autonnel-ui="radio"
      ref={ref}
      type="radio"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer accent-ds-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/30 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Radio.displayName = "AutonnelRadio";

export { Radio };
