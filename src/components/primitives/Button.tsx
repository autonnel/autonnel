import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const controlBase = [
  "inline-flex items-center justify-center gap-2 whitespace-nowrap",
  "rounded-[6px] text-sm font-medium transition-[background,border,color,box-shadow]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
  "disabled:pointer-events-none disabled:opacity-50",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");

const buttonVariants = cva(controlBase, {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
      destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
      warning: "bg-amber-500 text-white shadow-sm hover:bg-amber-600",
      outline: "border border-input bg-background text-foreground shadow-sm hover:bg-accent/80 hover:text-accent-foreground",
      secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
      ghost: "text-foreground hover:bg-accent/80 hover:text-accent-foreground",
      link: "h-auto px-0 text-primary underline-offset-4 hover:underline",
    },
    size: {
      default: "h-9 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-10 px-8",
      icon: "h-9 w-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, size, variant, ...buttonProps }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        data-autonnel-ui="button"
        ref={ref}
        className={cn(buttonVariants({ size, variant }), className)}
        {...buttonProps}
      />
    );
  },
);
Button.displayName = "AutonnelButton";

export { Button, buttonVariants };
