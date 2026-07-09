import type { PlatformOAuthPort } from './ports/outbound';

interface Deps {
  oauthFor(platform: string): PlatformOAuthPort;
  encodeState(input: { platform: string }): string;
  clientIdFor(platform: string): Promise<string>;
}

export class StartAdConnectionService {
  constructor(private readonly deps: Deps) {}

  async start(input: { platform: string; redirectUri: string }): Promise<{ authorizeUrl: string; state: string }> {
    const oauth = this.deps.oauthFor(input.platform);
    const state = this.deps.encodeState({ platform: input.platform });
    const clientId = await this.deps.clientIdFor(input.platform);
    return { authorizeUrl: oauth.buildAuthorizeUrl({ state, redirectUri: input.redirectUri, clientId }), state };
  }
}
