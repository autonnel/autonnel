import type { PlatformOAuthPort, OAuthTokenGrant } from '../../../application/ports/outbound';
import { metaCapability } from './capability';

type FetchLike = typeof fetch;

export class MetaOAuthAdapter implements PlatformOAuthPort {
  constructor(
    private readonly creds: { clientId: string; clientSecret: string },
    // Arrow, not bare `fetch`: called as `this.fetchImpl(...)` a bare reference rebinds `this` and
    // Workers throws "Illegal invocation". The arrow always calls global fetch unbound.
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  capability() { return metaCapability; }

  buildAuthorizeUrl(input: { state: string; redirectUri: string; clientId: string }): string {
    const q = new URLSearchParams({
      client_id: input.clientId,
      redirect_uri: input.redirectUri,
      state: input.state,
      scope: metaCapability.requiredConversionScopes.join(','),
      response_type: 'code',
    });
    return `${metaCapability.authorizeUrl}?${q.toString()}`;
  }

  async exchangeCode(input: { code: string; redirectUri: string }): Promise<OAuthTokenGrant> {
    const q = new URLSearchParams({
      client_id: this.creds.clientId,
      client_secret: this.creds.clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });
    const res = await this.fetchImpl(`${metaCapability.tokenUrl}?${q.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error(`META token exchange ${res.status}`);
    const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? json.access_token,
      expiresInSec: json.expires_in ?? 5_184_000,
      grantedScopes: metaCapability.requiredConversionScopes,
    };
  }

  async refresh(_input: { refreshToken: string }): Promise<OAuthTokenGrant> {
    throw new Error('META long-lived tokens are re-exchanged, not refreshed');
  }
}
