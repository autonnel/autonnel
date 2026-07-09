import type { PlatformOAuthPort, OAuthTokenGrant } from '../../../application/ports/outbound';
import { tiktokCapability } from './capability';

type FetchLike = typeof fetch;

export class TikTokOAuthAdapter implements PlatformOAuthPort {
  constructor(
    private readonly creds: { clientId: string; clientSecret: string },
    // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
    // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  capability() { return tiktokCapability; }

  buildAuthorizeUrl(input: { state: string; redirectUri: string; clientId: string }): string {
    const q = new URLSearchParams({
      app_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: tiktokCapability.requiredConversionScopes.join(','),
    });
    return `${tiktokCapability.authorizeUrl}?${q.toString()}`;
  }

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenGrant> {
    const res = await this.fetchImpl(tiktokCapability.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: this.creds.clientId,
        secret: this.creds.clientSecret,
        auth_code: input.code,
      }),
    });
    if (!res.ok) throw new Error(`TIKTOK token exchange ${res.status}`);
    const json = (await res.json()) as { data?: { access_token: string; refresh_token?: string; access_token_expire_in?: number } };
    const d = json.data;
    if (!d) throw new Error('TIKTOK token exchange: empty data');
    return {
      accessToken: d.access_token,
      refreshToken: d.refresh_token ?? d.access_token,
      expiresInSec: d.access_token_expire_in ?? 86_400,
      grantedScopes: tiktokCapability.requiredConversionScopes,
    };
  }

  async refresh(_input: { refreshToken: string }): Promise<OAuthTokenGrant> {
    throw new Error('TIKTOK refresh not implemented in OSS token mode');
  }
}
