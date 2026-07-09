import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readPage(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8');
}

describe('dashboard preview pages auth boundary', () => {
  it.each([
    'src/pages/design.astro',
    'src/pages/dashboard-preview.astro',
  ])('%s redirects anonymous users to login', (file) => {
    const source = readPage(file);

    expect(source).toContain("from '@/lib/auth/middleware'");
    expect(source).toContain('checkAuth(Astro)');
    expect(source).toContain("Astro.redirect('/login')");
  });
});
