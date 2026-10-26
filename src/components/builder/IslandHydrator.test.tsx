// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { useLanguage, usePageCurrency } from './LanguageContext';
import { useLivePricing } from './live-pricing';

vi.mock('./island-loaders', () => ({
  islandLoaders: {
    Probe: async () => function Probe() {
      return <span id="probe">{`${useLanguage()}|${usePageCurrency()}|${useLivePricing() ? 'live' : 'stored'}`}</span>;
    },
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function hydrate(html: string) {
  document.body.innerHTML = html;
  const { createRoot } = await import('react-dom/client');
  const { IslandHydrator } = await import('./IslandHydrator');
  const host = document.createElement('div');
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(<IslandHydrator />);
    await new Promise((r) => setTimeout(r, 20));
  });
  return document.getElementById('probe')?.textContent;
}

const island = '<div data-island="Probe"><script type="application/json" data-island-props>{}</script></div>';

describe('IslandHydrator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('island inherits page language and currency', async () => {
    const out = await hydrate(`<div class="landing-page" data-language="de" data-currency="EUR">${island}</div>`);
    expect(out).toBe('de|EUR|live');
  });

  it('falls back to en and store default', async () => {
    const out = await hydrate(`<div class="landing-page">${island}</div>`);
    expect(out).toBe('en||live');
  });
});
