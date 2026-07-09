import { describe, it, expect } from 'vitest';
import { makeIdentity } from './make-identity';

describe('makeIdentity composition root', () => {
  it('wires the inbound ports without a DI container', () => {
    const fakePrisma = {
      user: { findFirst: async () => null, upsert: async () => {} },
      membership: {}, role: {}, invitation: {}, apiKey: {}, session: {},
    } as any;
    const identity = makeIdentity({
      rawPrisma: fakePrisma,
      scopedPrisma: fakePrisma,
      sessionSecret: 'test-secret',
    });
    expect(typeof identity.tenantContext.establish).toBe('function');
    expect(typeof identity.authentication.login).toBe('function');
    expect(typeof identity.apiKeys.issue).toBe('function');
    expect(typeof identity.roleDashboard.listRoles).toBe('function');
  });
});
