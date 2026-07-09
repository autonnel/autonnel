import { describe, it, expect } from 'vitest';
import { DispatchPostbackService } from './dispatch-postback.service';
import { Postback } from '../domain/postback/postback';
import { ConversionEvent } from '../domain/value-objects/conversion-event';
import { RetryPolicy } from '../domain/value-objects/retry-policy';
import { AdAccountConnection } from '../domain/connection/ad-account-connection';
import { SealedToken } from '../domain/value-objects/sealed-token';

function activeConn() {
  const c = AdAccountConnection.connect({
    id: 'conn1', platform: 'META', externalAccountId: 'act_1',
    refreshToken: SealedToken.of({ ciphertext: 'c', iv: 'i', tokenVersion: 1 }),
    accessToken: SealedToken.of({ ciphertext: 'c', iv: 'i', tokenVersion: 1 }),
    accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
    grantedScopes: ['ads_management'], requiredConversionScopes: ['ads_management'],
  });
  c.addDestination({ id: 'd1', kind: 'PIXEL', externalId: 'px1', isDefault: true });
  return c;
}

function makeService(over: Record<string, unknown> = {}) {
  const saved: any[] = [];
  const pb = Postback.create({
    id: 'p1', destinationId: 'd1',
    event: ConversionEvent.create({ eventName: 'Purchase', eventId: 'Purchase:s1:sale1', eventTimeMs: 1 }),
    retryPolicy: RetryPolicy.default(),
  });
  return {
    saved, pb,
    svc: new DispatchPostbackService({
      postbackRepo: { findById: async () => pb, findByDedup: async () => null, claimDuePending: async () => [], save: async (p: any) => saved.push(p) },
      connectionRepo: { findById: async () => activeConn(), findByPlatformAccount: async () => null, list: async () => [], save: async () => {} },
      destinationToConnection: async () => 'conn1',
      tokenCipher: { open: async () => 'plain-token', seal: async () => SealedToken.of({ ciphertext: 'c', iv: 'i', tokenVersion: 1 }) },
      conversionApiFor: () => ({ platform: 'META', sendConversion: async () => ({ acknowledged: true, providerRef: 'fbtrace1' }) }),
      events: { publish: async () => {} },
      ...over,
    } as any),
  };
}

describe('DispatchPostbackService', () => {
  it('acknowledges a postback when the platform CAPI accepts it', async () => {
    const { svc, saved } = makeService();
    const res = await svc.dispatch({ postbackId: 'p1' });
    expect(res.status).toBe('ACKNOWLEDGED');
    expect(saved.at(-1).status).toBe('ACKNOWLEDGED');
    expect(saved.at(-1).providerRef).toBe('fbtrace1');
  });

  it('marks PENDING again on a retryable failure', async () => {
    const { svc, saved } = makeService({
      conversionApiFor: () => ({ platform: 'META', sendConversion: async () => ({ acknowledged: false, error: '429', retryable: true }) }),
    });
    const res = await svc.dispatch({ postbackId: 'p1' });
    expect(res.status).toBe('PENDING');
    expect(saved.at(-1).attemptCount).toBe(1);
  });

  it('fast-fails to FAILED/PENDING when the connection is degraded', async () => {
    const revoked = activeConn();
    revoked.revoke('manual');
    const { svc, saved } = makeService({
      connectionRepo: { findById: async () => revoked, findByPlatformAccount: async () => null, list: async () => [], save: async () => {} },
    });
    const res = await svc.dispatch({ postbackId: 'p1' });
    expect(['PENDING', 'DEAD']).toContain(res.status);
    expect(saved.at(-1).attempts.at(-1).error).toContain('CONNECTION_DEGRADED');
  });
});
