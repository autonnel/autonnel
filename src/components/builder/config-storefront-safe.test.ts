import { describe, it, expect, vi } from 'vitest';

vi.mock('@puckeditor/core', () => {
  throw new Error('Puck runtime must not load with the storefront component config');
});

describe('storefront component config', () => {
  it('loads without the Puck runtime, which generates random ids at module scope and fails in workerd', async () => {
    const { puckConfig } = await import('./config');
    expect(puckConfig.components).toBeTruthy();
  });
});
