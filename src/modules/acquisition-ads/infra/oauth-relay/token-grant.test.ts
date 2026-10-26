import { describe, it, expect } from 'vitest';
import { toGrant } from './token-grant';
import { metaCapability } from '../platforms/meta/capability';

describe('toGrant', () => {
  it('maps a META relay response, defaulting refreshToken to accessToken', () => {
    const grant = toGrant('META', JSON.stringify({
      access_token: 'EAAKZ-token',
      token_type: 'bearer',
      expires_in: 5183944,
    }));
    expect(grant).toEqual({
      accessToken: 'EAAKZ-token',
      refreshToken: 'EAAKZ-token',
      expiresInSec: 5183944,
      grantedScopes: metaCapability.requiredConversionScopes,
    });
  });

  it('maps a GOOGLE relay response including refresh_token and scope', () => {
    const grant = toGrant('GOOGLE_ADS', JSON.stringify({
      access_token: 'ya29.a0AfB',
      expires_in: 3599,
      refresh_token: '1//0gLk',
      scope: 'https://www.googleapis.com/auth/adwords',
      token_type: 'Bearer',
    }));
    expect(grant).toEqual({
      accessToken: 'ya29.a0AfB',
      refreshToken: '1//0gLk',
      expiresInSec: 3599,
      grantedScopes: ['https://www.googleapis.com/auth/adwords'],
    });
  });

  it('maps a TIKTOK relay response for contract symmetry, even though the relay disables it today', () => {
    const grant = toGrant('TIKTOK', JSON.stringify({
      access_token: 'act.example',
      expires_in: 86400,
      open_id: 'user-1',
      refresh_token: 'rft.example',
      scope: 'user.info.basic,video.list',
      token_type: 'Bearer',
    }));
    expect(grant).toEqual({
      accessToken: 'act.example',
      refreshToken: 'rft.example',
      expiresInSec: 86400,
      grantedScopes: ['user.info.basic', 'video.list'],
    });
  });

  it('falls back to the capability required scopes when scope is missing', () => {
    const grant = toGrant('META', JSON.stringify({ access_token: 'tok' }));
    expect(grant.grantedScopes).toEqual(metaCapability.requiredConversionScopes);
  });

  it('throws when data is not valid JSON', () => {
    expect(() => toGrant('META', '{not json')).toThrow(/not valid JSON/);
  });

  it('throws when access_token is missing', () => {
    expect(() => toGrant('META', JSON.stringify({ token_type: 'bearer' }))).toThrow(/access_token/);
  });

  it('throws when access_token is present but not a string', () => {
    expect(() => toGrant('META', JSON.stringify({ access_token: 12345 }))).toThrow(/access_token/);
  });

  it('logs a warning but still succeeds when GOOGLE has no refresh_token', () => {
    const grant = toGrant('GOOGLE', JSON.stringify({ access_token: 'ya29.x', expires_in: 3600 }));
    expect(grant.refreshToken).toBe('');
    expect(grant.accessToken).toBe('ya29.x');
  });

  it('rejects BING_ADS, which the relay does not support', () => {
    expect(() => toGrant('BING_ADS', JSON.stringify({ access_token: 'tok' }))).toThrow(/BING_ADS/);
  });

  it('uses default expiresInSec per platform when expires_in is missing', () => {
    expect(toGrant('META', JSON.stringify({ access_token: 'a' })).expiresInSec).toBe(5_184_000);
    expect(toGrant('GOOGLE', JSON.stringify({ access_token: 'a' })).expiresInSec).toBe(3_600);
    expect(toGrant('TIKTOK', JSON.stringify({ access_token: 'a' })).expiresInSec).toBe(86_400);
  });
});
