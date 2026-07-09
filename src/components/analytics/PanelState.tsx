import React from 'react';
import { Loader2 } from 'lucide-react';

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5 py-1" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-[6px] bg-ds-surface2" />
      ))}
    </div>
  );
}

export function PanelLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-ds-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-[13px]">{label}</span>
    </div>
  );
}

export function PanelError({ message }: { message: string }) {
  return (
    <div className="rounded-[8px] border border-ds-badBorder bg-ds-badBg px-4 py-3 text-[12.5px] text-ds-badText">
      {message}
    </div>
  );
}

export function PanelEmpty({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
      <div className="text-[13px] text-ds-muted">{message}</div>
    </div>
  );
}
