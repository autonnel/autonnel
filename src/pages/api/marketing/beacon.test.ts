import { describe, it, expect } from 'vitest';
import { handleBeacon } from './beacon';

describe('marketing beacon route', () => {
  it('captures attribution from the request body and returns 204', async () => {
    let captured: any;
    const res = await handleBeacon(
      new Request('https://shop.test/api/marketing/beacon', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 's1',
          landingUrl: 'https://shop.test/n/a?fbclid=x',
          query: { fbclid: 'x' },
        }),
        headers: { 'content-type': 'application/json' },
      }),
      { capture: async (i: any) => { captured = i; return { stored: true }; } } as any,
    );
    expect(res.status).toBe(204);
    expect(captured.sessionId).toBe('s1');
    expect(captured.query.fbclid).toBe('x');
  });

  it('returns 400 on missing sessionId', async () => {
    const res = await handleBeacon(
      new Request('https://shop.test/api/marketing/beacon', {
        method: 'POST', body: JSON.stringify({ landingUrl: 'x' }),
        headers: { 'content-type': 'application/json' },
      }),
      { capture: async () => ({ stored: true }) } as any,
    );
    expect(res.status).toBe(400);
  });
});
