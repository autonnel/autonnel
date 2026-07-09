import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('maintenance unlock cookie security', () => {
  it('does not write the raw maintenance password into the bypass cookie', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/pages/api/shop/maintenance-unlock.ts'),
      'utf8',
    );

    expect(source).not.toContain('encodeURIComponent(password)');
    expect(source).toContain('createMaintenanceUnlockToken');
  });
});
