import { describe, it, expect } from 'vitest';
import { makeAuthoring } from './make-authoring';

describe('makeAuthoring', () => {
  it('constructs the authoring use-case bundle from injected infra', () => {
    const fakeDb = {} as never;
    const fakeEvents = { publish: async () => {} };

    const authoring = makeAuthoring({
      db: fakeDb, events: fakeEvents,
      tenantId: 't1', invalidatePageCache: async () => {},
    });

    expect(authoring.funnelComposing).toBeDefined();
    expect(authoring.pageDashboard).toBeDefined();
    expect(authoring.aiChatSessions).toBeDefined();
  });
});
