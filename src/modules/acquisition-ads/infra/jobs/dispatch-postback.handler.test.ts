import { describe, it, expect } from 'vitest';
import { makeDispatchPostbackHandler } from './dispatch-postback.handler';

describe('dispatch-postback job handler', () => {
  it('declares the kind and delegates to the dispatch service', async () => {
    let called: any;
    const handler = makeDispatchPostbackHandler({
      dispatchService: { dispatch: async (i: any) => { called = i; return { status: 'ACKNOWLEDGED' }; } } as any,
    });
    expect(handler.kind).toBe('ads.postback.dispatch');
    const out = await handler.run({ payload: { postbackId: 'p1' } });
    expect(called.postbackId).toBe('p1');
    expect(out.status).toBe('ACKNOWLEDGED');
  });
});
