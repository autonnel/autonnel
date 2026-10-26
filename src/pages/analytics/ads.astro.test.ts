import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// No Astro container-render harness exists in this repo (see other src/**/*.astro files -- none
// have a companion test), so this reads the source text directly. Cheap and exact for a static
// copy/link fix; a real render test would need the full Astro page pipeline for no extra coverage.
const source = readFileSync(path.join(__dirname, 'ads.astro'), 'utf-8');

describe('analytics/ads.astro empty-state "Go to Settings" link', () => {
  it('points at /settings/ads, where the platform Connect buttons live, not /marketing', () => {
    const emptyState = source.slice(source.indexOf('No ad accounts connected yet'));
    const href = emptyState.match(/href="([^"]+)"/)?.[1];
    expect(href).toBe('/settings/ads');
  });
});
