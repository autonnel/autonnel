import { PayloadAssembler } from '../domain/services/payload-assembler';
import { HashedIdentity } from '../domain/value-objects/hashed-identity';
import { canonicalAdPlatform } from '../domain/value-objects/click-identifier';
import type {
  PostbackRepositoryPort,
  ConnectionRepositoryPort,
  PlatformConversionApiPort,
  TokenCipherPort,
} from './ports/outbound';

interface Deps {
  postbackRepo: PostbackRepositoryPort;
  connectionRepo: ConnectionRepositoryPort;
  destinationToConnection(destinationId: string): Promise<string | null>;
  tokenCipher: TokenCipherPort;
  conversionApiFor: (platform: string) => PlatformConversionApiPort;
  events: { publish(event: { type: string; payload: unknown }): Promise<void> };
}

export class DispatchPostbackService {
  private readonly assembler = new PayloadAssembler();
  constructor(private readonly deps: Deps) {}

  async dispatch(input: { postbackId: string }): Promise<{ status: string }> {
    const postback = await this.deps.postbackRepo.findById(input.postbackId);
    if (!postback) return { status: 'NOT_FOUND' };
    if (postback.isTerminal()) return { status: postback.status };

    const connId = await this.deps.destinationToConnection(postback.destinationId);
    const connection = connId ? await this.deps.connectionRepo.findById(connId) : null;

    postback.beginDispatch();

    if (!connection || !connection.isCapiCapable()) {
      postback.fail('CONNECTION_DEGRADED', true);
      await this.deps.postbackRepo.save(postback);
      return { status: postback.status };
    }

    const destination = connection.destinations.find((d) => d.id === postback.destinationId)!;
    const accessToken = await this.deps.tokenCipher.open(connection.accessToken);
    const conversionApi = this.deps.conversionApiFor(connection.platform);

    const ctx = postback.dispatchContext;
    // connection.platform may be a stored alias ('FACEBOOK'); click identifiers carry the canonical
    // 'META'/'GOOGLE'/'TIKTOK', so normalize before matching or the identifiers get dropped.
    const platform = canonicalAdPlatform(connection.platform);
    const identifiers = (ctx?.clickIdentifiers ?? []).filter((ci) => ci.platform === platform);
    const hashedIdentity = ctx?.hashedIdentity ?? HashedIdentity.fromContactHandle({});

    const payload = this.assembler.assemble({
      decision: 'SEND_FULL',
      identifiers,
      hashedIdentity,
    });

    const result = await conversionApi.sendConversion({
      accessToken,
      destination,
      event: postback.event,
      payload,
    });

    if (result.acknowledged) {
      postback.acknowledge(result.providerRef ?? 'ack');
      await this.deps.postbackRepo.save(postback);
      await this.deps.events.publish({ type: 'ConversionReported', payload: { postbackId: postback.id } });
      return { status: postback.status };
    }

    postback.fail(result.error ?? 'unknown', result.retryable ?? false);
    await this.deps.postbackRepo.save(postback);
    if (postback.status === 'DEAD') {
      await this.deps.events.publish({ type: 'PostbackDeadLettered', payload: { postbackId: postback.id } });
    }
    return { status: postback.status };
  }
}
