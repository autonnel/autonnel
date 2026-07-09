import type * as React from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "./Alert";

type AlertBoxType = "error" | "warning" | "success" | "info";

interface AlertBoxProps {
  type: AlertBoxType;
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

interface AlertBoxStyle {
  variant: "default" | "destructive";
  classes: string;
  Icon: LucideIcon;
}

const STYLES: Record<AlertBoxType, AlertBoxStyle> = {
  error: {
    variant: "destructive",
    classes: "border-red-500/50 text-red-600 bg-red-50 [&>svg]:text-red-600",
    Icon: AlertCircle,
  },
  warning: {
    variant: "default",
    classes:
      "border-amber-500/50 text-amber-600 bg-amber-50 [&>svg]:text-amber-600",
    Icon: AlertTriangle,
  },
  success: {
    variant: "default",
    classes:
      "border-green-500/50 text-green-600 bg-green-50 [&>svg]:text-green-600",
    Icon: CheckCircle2,
  },
  info: {
    variant: "default",
    classes: "border-blue-500/50 text-blue-600 bg-blue-50 [&>svg]:text-blue-600",
    Icon: Info,
  },
};

function AlertBox({
  type,
  title,
  children,
  className = "",
  onClose,
}: AlertBoxProps) {
  const { variant, classes, Icon } = STYLES[type];

  return (
    <Alert
      variant={variant}
      className={cn(classes, onClose && "pr-10", className)}
      data-autonnel-ui="alert-box"
      data-alert-type={type}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="flex-1">
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertDescription>{children}</AlertDescription>
      </div>
      {onClose && (
        <button
          type="button"
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Dismiss"
          data-autonnel-ui="alert-box-close"
          onClick={onClose}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </Alert>
  );
}

export default AlertBox;
export { Alert, AlertTitle, AlertDescription };
