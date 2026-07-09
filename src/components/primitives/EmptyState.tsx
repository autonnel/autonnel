import type * as React from "react";

import { cn } from "@/lib/utils";
import { FadeContent } from "./animations";
import { Button } from "./Button";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  icon?: React.ReactNode | string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={cn("text-center py-20", className)}
      data-autonnel-ui="empty-state"
    >
      {icon && (
        <div
          className="w-20 h-20 rounded-2xl bg-muted/50 mx-auto mb-6 flex items-center justify-center"
          data-autonnel-ui="empty-state-icon"
        >
          {typeof icon === "string" ? (
            <span className="text-4xl">{icon}</span>
          ) : (
            icon
          )}
        </div>
      )}

      <FadeContent delay={0.2} duration={0.4}>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
      </FadeContent>

      {description && (
        <FadeContent delay={0.3} duration={0.4}>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {description}
          </p>
        </FadeContent>
      )}

      {action && (
        <FadeContent delay={0.4} duration={0.4}>
          <Button onClick={action.onClick} variant="default" size="lg">
            {action.label}
          </Button>
        </FadeContent>
      )}
    </div>
  );
}

export default EmptyState;
