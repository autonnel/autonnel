import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The per-platform ads detail page moved from `ads/[id]/data.astro` to
// `marketing/[id].astro`. It must still gate on auth + the MARKETING feature and
// resolve the record through the tenant-scoped loader (a foreign id yields null ->
// redirect), never a raw global lookup that could leak another tenant's platform.
const source = readFileSync(resolve('src/pages/marketing/[id].astro'), 'utf8');

describe('marketing ad platform detail page security', () => {
  it('requires an authenticated session', () => {
    expect(source).toContain("import { checkAuth } from '@/lib/auth/middleware'");
    expect(source).toContain('await checkAuth(Astro)');
    expect(source).toContain("Astro.redirect('/login')");
  });

  it('enforces the MARKETING permission', () => {
    expect(source).toContain("import { FEATURES, userHasFeature } from '@/lib/rbac'");
    expect(source).toContain('userHasFeature(viewer.id, FEATURES.MARKETING)');
    expect(source).toContain("Astro.redirect('/')");
  });

  it('loads the platform through the tenant-scoped loader, not a raw global lookup', () => {
    expect(source).toContain('loadAdPlatformDetail(id)');
    expect(source).toContain("Astro.redirect('/marketing')");
    expect(source).not.toContain('findUnique');
  });
});
