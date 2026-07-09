import type * as React from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...skeletonProps }: SkeletonProps) {
  return (
    <div
      data-autonnel-ui="skeleton"
      aria-hidden={skeletonProps["aria-hidden"] ?? true}
      className={cn("animate-pulse rounded-[6px] bg-muted/80", className)}
      {...skeletonProps}
    />
  );
}

export { Skeleton };
