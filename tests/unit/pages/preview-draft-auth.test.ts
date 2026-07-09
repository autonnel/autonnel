import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('preview route auth boundary', () => {
  it('always requires an authenticated admin session', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/preview/[...slug].astro'),
      'utf8',
    );

    expect(source).toContain("from '@/lib/auth/middleware'");
    expect(source).toContain('checkAuth(Astro)');
    expect(source).toContain("Astro.redirect('/login')");
    expect(source).not.toMatch(/searchParams\.get\(['"]draft['"]\)/);
  });
});
