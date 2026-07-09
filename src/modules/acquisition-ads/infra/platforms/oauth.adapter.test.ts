import { describe, it, expect } from 'vitest';
import { MetaOAuthAdapter } from './meta/oauth.adapter';
import { GoogleOAuthAdapter } from './google/oauth.adapter';
import { TikTokOAuthAdapter } from './tiktok/oauth.adapter';

describe('OAuth adapters', () => {
  it('Meta buildAuthorizeUrl includes client_id, scope, state and redirect_uri', () => {
    const a = new MetaOAuthAdapter({ clientId: 'CID', clientSecret: 'SEC' });
    const url = a.buildAuthorizeUrl({ state: 'ST', redirectUri: 'https://x/cb', clientId: 'CID' });
    expect(url).toContain('client_id=CID');
    expect(url).toContain('state=ST');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fx%2Fcb');
    expect(url).toContain('ads_management');
  });

  it('Meta exchangeCode normalizes the token response', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600 }), { status: 200 });
    const a = new MetaOAuthAdapter({ clientId: 'CID', clientSecret: 'SEC' }, fetchImpl as any);
    const grant = await a.exchangeCode({ code: 'C', redirectUri: 'https://x/cb' });
    expect(grant.accessToken).toBe('AT');
    expect(grant.expiresInSec).toBe(3600);
    expect(grant.grantedScopes).toEqual(['ads_management', 'business_management']);
  });

  it('Google + TikTok build authorize urls from their capabilities', () => {
    const g = new GoogleOAuthAdapter({ clientId: 'G', clientSecret: 'S' });
    expect(g.buildAuthorizeUrl({ state: 'X', redirectUri: 'https://x/cb', clientId: 'G' })).toContain('accounts.google.com');
    const t = new TikTokOAuthAdapter({ clientId: 'T', clientSecret: 'S' });
    expect(t.buildAuthorizeUrl({ state: 'X', redirectUri: 'https://x/cb', clientId: 'T' })).toContain('tiktok.com');
  });
});
