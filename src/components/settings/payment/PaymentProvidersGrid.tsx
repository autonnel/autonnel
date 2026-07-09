import React from 'react';
import { Badge as DsBadge } from '../../primitives/ds';
import { getProviderLogo } from './logos';

export interface ProviderCardData {
  id: string;
  displayName: string;
  configured: boolean;
  mode?: string;
  href: string;
}

interface Props {
  providers: ProviderCardData[];
}

export default function PaymentProvidersGrid({ providers }: Props) {
  if (providers.length === 0) {
    return (
      <div className="text-[13px] text-ds-muted py-8 text-center">
        No payment providers registered.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {providers.map((p) => (
        <ProviderCard key={p.id} provider={p} />
      ))}
    </div>
  );
}

function ProviderCard({ provider }: { provider: ProviderCardData }) {
  const chipClass = provider.configured
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-zinc-100 text-zinc-600 border border-zinc-200';
  const chipText = provider.configured ? 'connected' : 'not connected';

  return (
    <a
      href={provider.href}
      aria-label={`Manage ${provider.displayName} connection`}
      className="block rounded-[10px] border border-ds-line bg-ds-card shadow-[0_1px_2px_rgba(17,24,39,.04)] hover:shadow-[0_4px_12px_rgba(17,24,39,.08)] transition-shadow"
    >
      <div className="px-5 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-medium ${chipClass}`}
          >
            {chipText}
          </span>
          {provider.configured && provider.mode && (
            <DsBadge tone="ok">{provider.mode.toUpperCase()}</DsBadge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-shrink-0">{getProviderLogo(provider.id)}</div>
          <span className="text-[13px] font-medium text-ds-accent whitespace-nowrap">
            Manage connection →
          </span>
        </div>
      </div>
    </a>
  );
}
