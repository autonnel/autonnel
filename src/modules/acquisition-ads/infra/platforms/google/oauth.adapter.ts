import type { PlatformOAuthPort, OAuthTokenGrant } from '../../../application/ports/outbound';
import { googleCapability } from './capability';

type FetchLike = typeof fetch;

export class GoogleOAuthAdapter implements PlatformOAuthPort {
  constructor(
    private readonly creds: { clientId: string; clientSecret: string },
    // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
    // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  capability() { return googleCapability; }

  buildAuthorizeUrl(input: { state: string; redirectUri: string; clientId: string }): string {
    const q = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: googleCapability.requiredConversionScopes.join(' '),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${googleCapability.authorizeUrl}?${q.toString()}`;
  }

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenGrant> {
    const res = await this.fetchImpl(googleCapability.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        redirect_uri: input.redirectUri,
        code: input.code,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) throw new Error(`GOOGLE token exchange ${res.status}`);
    const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? '',
      expiresInSec: json.expires_in ?? 3600,
      grantedScopes: googleCapability.requiredConversionScopes,
    };
  }

  async refresh(input: { refreshToken: string }): Promise<OAuthTokenGrant> {
    const res = await this.fetchImpl(googleCapability.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
        refresh_token: input.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) throw new Error(`GOOGLE token refresh ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in?: number };
    return {
      accessToken: json.access_token,
      refreshToken: input.refreshToken,
      expiresInSec: json.expires_in ?? 3600,
      grantedScopes: googleCapability.requiredConversionScopes,
    };
  }
}
