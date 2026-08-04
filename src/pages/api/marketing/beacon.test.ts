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

describe('marketing beacon — field bounds', () => {
  function captureIngest() {
    const captured: Record<string, unknown>[] = [];
    return {
      captured,
      ingest: {
        capture: async (input: Record<string, unknown>) => {
          captured.push(input);
          return { stored: true };
        },
      } as never,
    };
  }

  const post = (body: unknown) =>
    new Request('https://shop.test/api/marketing/beacon', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('truncates sessionId and landingUrl to their caps', async () => {
    const { captured, ingest } = captureIngest();
    await handleBeacon(
      post({ sessionId: 's'.repeat(5000), landingUrl: `https://x.test/${'p'.repeat(5000)}` }),
      ingest,
    );
    expect((captured[0].sessionId as string).length).toBe(512);
    expect((captured[0].landingUrl as string).length).toBe(2048);
  });

  it('drops a query object with too many keys', async () => {
    const { captured, ingest } = captureIngest();
    const query: Record<string, string> = {};
    for (let i = 0; i < 200; i++) query[`k${i}`] = 'v';
    await handleBeacon(post({ sessionId: 's1', landingUrl: 'https://x.test/', query }), ingest);
    expect(Object.keys(captured[0].query as object)).toHaveLength(0);
  });

  it('truncates individual query values', async () => {
    const { captured, ingest } = captureIngest();
    await handleBeacon(
      post({ sessionId: 's1', landingUrl: 'https://x.test/', query: { fbclid: 'z'.repeat(5000) } }),
      ingest,
    );
    expect(((captured[0].query as Record<string, string>).fbclid).length).toBe(512);
  });

  it('keeps a normal payload intact', async () => {
    const { captured, ingest } = captureIngest();
    await handleBeacon(
      post({ sessionId: 's1', landingUrl: 'https://x.test/lp', query: { fbclid: 'abc' }, fbp: 'fb.1.2.3' }),
      ingest,
    );
    expect(captured[0]).toMatchObject({ sessionId: 's1', landingUrl: 'https://x.test/lp', fbp: 'fb.1.2.3' });
    expect(captured[0].query).toEqual({ fbclid: 'abc' });
  });

  it('rejects a non-string sessionId instead of coercing it', async () => {
    const { ingest } = captureIngest();
    const res = await handleBeacon(post({ sessionId: { evil: true }, landingUrl: 'https://x.test/' }), ingest);
    expect(res.status).toBe(400);
  });
});
