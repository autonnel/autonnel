import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "./Badge";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_MAP: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-transparent",
  PAID: "bg-green-100 text-green-800 border-transparent",
  SUCCESS: "bg-green-100 text-green-800 border-transparent",
  COMPLETED: "bg-green-100 text-green-800 border-transparent",
  ACTIVE: "bg-green-100 text-green-800 border-transparent",
  PUBLISHED: "bg-green-100 text-green-800 border-transparent",
  DRAFT: "bg-amber-100 text-amber-800 border-transparent",
  WARNING: "bg-amber-100 text-amber-800 border-transparent",
  PROCESSING: "bg-blue-100 text-blue-800 border-transparent",
  INFO: "bg-blue-100 text-blue-800 border-transparent",
  PARTIAL_REFUND: "bg-orange-100 text-orange-800 border-transparent",
  PARTIALLY_REFUNDED: "bg-orange-100 text-orange-800 border-transparent",
  FULL_REFUND: "bg-purple-100 text-purple-800 border-transparent",
  REFUNDED: "bg-purple-100 text-purple-800 border-transparent",
  FAILED: "destructive",
  ERROR: "destructive",
  INACTIVE: "secondary",
};

function normalizeStatus(status: string): string {
  return status.toUpperCase().replace(/\s+/g, "_");
}

function toDisplayText(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusBadge({ status, size = "md", className = "" }: StatusBadgeProps) {
  const mapped = STATUS_MAP[normalizeStatus(status)];
  const displayText = toDisplayText(status);
  const sizeClass =
    size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-0.5";

  if (mapped === "destructive" || mapped === "secondary") {
    return (
      <Badge variant={mapped} className={cn(sizeClass, className)}>
        {displayText}
      </Badge>
    );
  }

  return (
    <Badge className={cn(sizeClass, mapped, className)}>{displayText}</Badge>
  );
}

export default StatusBadge;
export { Badge, badgeVariants };
