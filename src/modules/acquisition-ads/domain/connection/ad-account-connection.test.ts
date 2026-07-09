import { describe, it, expect } from 'vitest';
import { AdAccountConnection } from './ad-account-connection';
import { SealedToken } from '../value-objects/sealed-token';
import { StaleTokenVersion, IllegalConnectionTransition } from '../errors';

const seal = (v = 1) => SealedToken.of({ ciphertext: 'c', iv: 'i', tokenVersion: v });

function active() {
  return AdAccountConnection.connect({
    id: 'conn1',
    platform: 'META',
    externalAccountId: 'act_123',
    refreshToken: seal(1),
    accessToken: seal(1),
    accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
    grantedScopes: ['ads_management'],
    requiredConversionScopes: ['ads_management'],
  });
}

describe('AdAccountConnection', () => {
  it('is CAPI-capable when granted scopes superset required and status ACTIVE', () => {
    const c = active();
    expect(c.status).toBe('ACTIVE');
    expect(c.isCapiCapable()).toBe(true);
  });

  it('is NOT a valid postback destination once revoked', () => {
    const c = active();
    c.revoke('manual');
    expect(c.status).toBe('REVOKED');
    expect(c.isCapiCapable()).toBe(false);
    expect(() => c.assertCanDispatch()).toThrow(/not dispatchable/);
  });

  it('cannot transition REVOKED back to ACTIVE', () => {
    const c = active();
    c.revoke('manual');
    expect(() => c.markActive()).toThrow(IllegalConnectionTransition);
  });

  it('rotateTokens bumps tokenVersion and rejects a stale-version rotation', () => {
    const c = active();
    c.rotateTokens({
      expectedTokenVersion: 1,
      accessToken: seal(2),
      refreshToken: seal(2),
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000),
    });
    expect(c.tokenVersion).toBe(2);
    expect(() =>
      c.rotateTokens({
        expectedTokenVersion: 1,
        accessToken: seal(3),
        refreshToken: seal(3),
        accessTokenExpiresAt: new Date(),
      }),
    ).toThrow(StaleTokenVersion);
  });

  it('allows at most one default destination per kind', () => {
    const c = active();
    c.addDestination({ id: 'd1', kind: 'PIXEL', externalId: 'px1', isDefault: true });
    c.addDestination({ id: 'd2', kind: 'PIXEL', externalId: 'px2', isDefault: true });
    const defaults = c.destinations.filter((d) => d.kind === 'PIXEL' && d.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('d2');
  });
});
