import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-[8px] border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground [&>svg]:text-foreground",
        destructive: "border-destructive/50 text-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...alertProps }, ref) => (
  <div
    data-autonnel-ui="alert"
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...alertProps}
  />
));
Alert.displayName = "AutonnelAlert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...titleProps }, ref) => (
  <h5
    data-autonnel-ui="alert-title"
    ref={ref}
    className={cn("mb-1 font-medium leading-tight", className)}
    {...titleProps}
  />
));
AlertTitle.displayName = "AutonnelAlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...descriptionProps }, ref) => (
  <div
    data-autonnel-ui="alert-description"
    ref={ref}
    className={cn("text-sm [&_p]:leading-relaxed", className)}
    {...descriptionProps}
  />
));
AlertDescription.displayName = "AutonnelAlertDescription";

export { Alert, AlertTitle, AlertDescription };
