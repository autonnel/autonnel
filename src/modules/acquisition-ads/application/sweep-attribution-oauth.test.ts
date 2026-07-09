import { describe, it, expect } from 'vitest';
import { RetrySweepService } from './retry-sweep.service';
import { CaptureAttributionService } from './capture-attribution.service';
import { CompleteAdConnectionService } from './complete-ad-connection.service';
import { SealedToken } from '../domain/value-objects/sealed-token';

describe('RetrySweepService', () => {
  it('enqueues a dispatch job for each due pending postback', async () => {
    const enqueued: any[] = [];
    const svc = new RetrySweepService({
      postbackRepo: {
        claimDuePending: async () => [{ id: 'p1', destinationId: 'd1', eventId: 'e1' }, { id: 'p2', destinationId: 'd2', eventId: 'e2' }],
        findById: async () => null, findByDedup: async () => null, save: async () => {},
      },
      jobQueue: { enqueue: async (j: any) => enqueued.push(j) },
      now: () => 1000,
    } as any);
    const res = await svc.retrySweep({ limit: 50 });
    expect(res.processed).toBe(2);
    expect(enqueued[0].kind).toBe('ads.postback.dispatch');
  });
});

describe('CaptureAttributionService', () => {
  it('stores an AttributionTouch keyed by session with a TTL', async () => {
    const puts: any[] = [];
    const svc = new CaptureAttributionService({
      attributionStore: { put: async (x: any) => puts.push(x), get: async () => null },
    } as any);
    const res = await svc.capture({
      sessionId: 's1', query: { fbclid: 'x' },
      landingUrl: 'https://shop.test/n/a?fbclid=x', landingTimestampMs: 1700,
    });
    expect(res.stored).toBe(true);
    expect(puts[0].key).toContain('s1');
    expect(puts[0].ttlSec).toBeGreaterThan(0);
  });
});

describe('CompleteAdConnectionService', () => {
  it('exchanges the code, seals tokens, discovers destinations, saves ACTIVE', async () => {
    const saved: any[] = [];
    const svc = new CompleteAdConnectionService({
      oauthFor: () => ({
        capability: () => ({
          platform: 'META', apiVersion: 'v21.0', authorizeUrl: '', tokenUrl: '',
          requiredConversionScopes: ['ads_management'], standardEventNames: [], dedupField: 'event_id',
        }),
        exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r', expiresInSec: 3600, grantedScopes: ['ads_management'] }),
        refresh: async () => ({ accessToken: 'a', refreshToken: 'r', expiresInSec: 3600, grantedScopes: ['ads_management'] }),
        buildAuthorizeUrl: () => '',
      }),
      discoveryFor: () => ({ discover: async () => [{ id: 'd1', kind: 'PIXEL', externalId: 'px1', isDefault: true }] }),
      tokenCipher: { seal: async () => SealedToken.of({ ciphertext: 'c', iv: 'i', tokenVersion: 1 }), open: async () => 'a' },
      connectionRepo: { save: async (c: any) => saved.push(c), findById: async () => null, findByPlatformAccount: async () => null, list: async () => [] },
      events: { publish: async () => {} },
      decodeState: () => ({ platform: 'META', externalAccountId: 'act_1' }),
      newId: () => 'conn1',
    } as any);
    const res = await svc.complete({ state: 's', code: 'c', redirectUri: 'https://x/cb' });
    expect(res.connectionId).toBe('conn1');
    expect(saved[0].status).toBe('ACTIVE');
    expect(saved[0].destinations).toHaveLength(1);
  });
});
