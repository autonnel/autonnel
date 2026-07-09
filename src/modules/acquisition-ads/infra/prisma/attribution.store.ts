import { AttributionTouch } from '../../domain/value-objects/attribution-touch';
import { ClickIdentifier } from '../../domain/value-objects/click-identifier';
import type { AttributionStorePort } from '../../application/ports/outbound';

interface TouchDelegate {
  findFirst(args: { where: Record<string, unknown> }): Promise<any | null>;
  upsert(args: unknown): Promise<unknown>;
}

function toDomain(row: any): AttributionTouch {
  const clickIdentifiers = (row.touch.clickIdentifiers as any[]).map((c: any) =>
    ClickIdentifier.fromPersistence({
      platform: c.platform,
      field: c.field,
      value: c.value,
      rawParam: c.rawParam,
    }),
  );
  return AttributionTouch.create({
    clickIdentifiers,
    fbp: row.touch.fbp,
    ga: row.touch.ga,
    landingUrl: row.touch.landingUrl,
  });
}

export class PrismaAttributionStore implements AttributionStorePort {
  constructor(private readonly delegate: TouchDelegate) {}

  async put(input: { key: string; touch: AttributionTouch; ttlSec: number }): Promise<void> {
    let sessionId: string;
    const parts = input.key.split(':');
    sessionId = parts.length >= 2 ? parts.slice(1).join(':') : input.key;
    const expiresAt = new Date(Date.now() + input.ttlSec * 1000);
    await this.delegate.upsert({
      where: { id: input.key },
      create: {
        id: input.key,
        sessionId,
        touch: input.touch.toPersistence(),
        expiresAt,
      },
      update: {
        touch: input.touch.toPersistence(),
        expiresAt,
      },
    });
  }

  async get(key: string): Promise<AttributionTouch | null> {
    const row = await this.delegate.findFirst({ where: { id: key } });
    if (!row) return null;
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return null;
    return toDomain(row);
  }
}
