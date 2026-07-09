import { describe, it, expect } from 'vitest';
import type {
  ConnectionRepositoryPort,
  PlatformConversionApiPort,
  PlatformOAuthPort,
} from './outbound';
import type { AttributionIngestPort } from './inbound';

describe('ports contract', () => {
  it('a fake AttributionIngestPort + repo + platform ports satisfy the interfaces', async () => {
    const ingest: AttributionIngestPort = {
      capture: async () => ({ stored: true }),
    };
    const repo: Pick<ConnectionRepositoryPort, 'findById'> = {
      findById: async () => null,
    };
    const oauth: Pick<PlatformOAuthPort, 'buildAuthorizeUrl'> = {
      buildAuthorizeUrl: () => 'https://auth.example/x',
    };
    const capi: Pick<PlatformConversionApiPort, 'sendConversion'> = {
      sendConversion: async () => ({ acknowledged: true, providerRef: 'ref' }),
    };
    expect((await ingest.capture({} as never)).stored).toBe(true);
    expect(await repo.findById('x')).toBeNull();
    expect(oauth.buildAuthorizeUrl({} as never)).toContain('http');
    expect((await capi.sendConversion({} as never)).acknowledged).toBe(true);
  });
});
