import React, { useEffect, useState } from 'react';
import type { CustomField } from '@puckeditor/core';
import { SUPPORTED_PAGE_CURRENCIES } from '@/lib/i18n/page-currencies';

const STORE_DEFAULT_LABEL = 'Store default';

export function currencyOptions(regionCurrencies: string[]): { label: string; value: string }[] {
  const supported = new Set(SUPPORTED_PAGE_CURRENCIES);
  const codes = [...new Set(regionCurrencies.map((c) => c.toUpperCase()))].filter((c) => supported.has(c));
  return [{ label: STORE_DEFAULT_LABEL, value: '' }, ...codes.map((c) => ({ label: c, value: c }))];
}

function PageCurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [regionCurrencies, setRegionCurrencies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/shop/regions')
      .then((res) => (res.ok ? res.json() : { regions: [] }) as Promise<{ regions?: { currencyCode?: string }[] }>)
      .then((data) => {
        if (cancelled) return;
        setRegionCurrencies((data.regions ?? []).map((r) => r.currencyCode).filter((c): c is string => !!c));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const options = currencyOptions(regionCurrencies);
  if (value && !options.some((o) => o.value === value)) options.push({ label: value, value });

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #D1D5DB', background: 'white' }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function createPageCurrencyField(): CustomField<string | undefined> {
  return {
    type: 'custom',
    label: 'Page Currency',
    render: ({ value, onChange }) => <PageCurrencySelect value={value || ''} onChange={onChange} />,
  };
}
