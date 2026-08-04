import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => ({ dbFails: false }));

vi.mock('@/lib/db', () => ({
  getBasePrisma: () => ({
    $queryRaw: async () => {
      if (h.dbFails) {
        throw new Error("Can't reach database server at internal-pg.cluster.local:5432 (db=autonnel_prod)");
      }
      return [{ 1: 1 }];
    },
  }),
}));
vi.mock('@/lib/adapters/cache', () => ({ getCache: () => ({}) }));

import { GET } from '../health';

describe('GET /api/health — no internal detail', () => {
  it('reports unhealthy without echoing the exception text', async () => {
    h.dbFails = true;
    const res = await GET({} as never);
    const body = await res.text();
    expect(res.status).toBe(503);
    expect(body).toContain('"status":"unhealthy"');
    expect(body).not.toContain('internal-pg.cluster.local');
    expect(body).not.toContain('5432');
    expect(body).not.toContain('autonnel_prod');
    // "status":"error" is the intended signal; an "error" DETAIL field is what must never ship.
    expect(body).toContain('"status":"error"');
    expect(body).not.toMatch(/"error"\s*:/);
  });

  it('reports healthy on success', async () => {
    h.dbFails = false;
    const res = await GET({} as never);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('"status":"healthy"');
  });
});
