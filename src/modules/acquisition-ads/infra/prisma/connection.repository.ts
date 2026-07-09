import { AdAccountConnection } from '../../domain/connection/ad-account-connection';
import { SealedToken } from '../../domain/value-objects/sealed-token';
import type { ConnectionRepositoryPort } from '../../application/ports/outbound';
import type { PlatformRef } from '../../domain/value-objects/platform-ref';

interface ConnectionDelegate {
  findFirst(args: { where: Record<string, unknown>; include?: Record<string, unknown> }): Promise<any | null>;
  findMany(args?: unknown): Promise<any[]>;
  upsert(args: unknown): Promise<unknown>;
}

interface DestinationDelegate {
  upsert(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<unknown>;
}

function tokenFromRow(t: any): SealedToken {
  return SealedToken.of({ ciphertext: t.ciphertext, iv: t.iv, tokenVersion: t.tokenVersion });
}

function toDomain(row: any): AdAccountConnection {
  return AdAccountConnection.reconstitute({
    id: row.id,
    platform: row.platform as PlatformRef,
    externalAccountId: row.externalAccountId,
    status: row.status,
    refreshToken: tokenFromRow(row.refreshToken),
    accessToken: tokenFromRow(row.accessToken),
    accessTokenExpiresAt: new Date(row.accessTokenExpiresAt),
    grantedScopes: row.grantedScopes as string[],
    requiredConversionScopes: row.requiredScopes as string[],
    destinations: ((row.destinations as any[]) ?? []).map((d: any) => ({
      id: d.id,
      kind: d.kind,
      externalId: d.externalId,
      isDefault: d.isDefault,
    })),
  });
}

export class PrismaConnectionRepository implements ConnectionRepositoryPort {
  constructor(
    private readonly connDelegate: ConnectionDelegate,
    private readonly destDelegate?: DestinationDelegate,
  ) {}

  async findById(id: string): Promise<AdAccountConnection | null> {
    const row = await this.connDelegate.findFirst({
      where: { id },
      include: { destinations: true },
    });
    return row ? toDomain(row) : null;
  }

  async findByPlatformAccount(platform: PlatformRef, externalAccountId: string): Promise<AdAccountConnection | null> {
    const row = await this.connDelegate.findFirst({
      where: { platform, externalAccountId },
      include: { destinations: true },
    });
    return row ? toDomain(row) : null;
  }

  async list(): Promise<AdAccountConnection[]> {
    const rows = (await this.connDelegate.findMany?.({ include: { destinations: true } })) ?? [];
    return rows.map(toDomain);
  }

  async save(conn: AdAccountConnection): Promise<void> {
    const data = {
      id: conn.id,
      platform: conn.platform,
      externalAccountId: conn.externalAccountId,
      status: conn.status,
      accessToken: conn.accessToken.toJSON(),
      refreshToken: conn.refreshToken.toJSON(),
      accessTokenExpiresAt: conn.accessTokenExpiresAt,
      grantedScopes: conn.grantedScopes,
      requiredScopes: conn.requiredConversionScopes,
      tokenVersion: conn.tokenVersion,
    };
    await this.connDelegate.upsert({ where: { id: conn.id }, create: data, update: data });

    if (this.destDelegate) {
      await this.destDelegate.deleteMany({ where: { connectionId: conn.id } });
      for (const d of conn.destinations) {
        await this.destDelegate.upsert({
          where: { id: d.id },
          create: {
            id: d.id,
            connectionId: conn.id,
            kind: d.kind,
            externalId: d.externalId,
            isDefault: d.isDefault,
          },
          update: {
            connectionId: conn.id,
            kind: d.kind,
            externalId: d.externalId,
            isDefault: d.isDefault,
          },
        });
      }
    }
  }
}
