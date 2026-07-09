import { describe, it, expect } from 'vitest';
import { PrismaPostbackRepository } from './postback.repository';
import { Postback } from '../../domain/postback/postback';
import { ConversionEvent } from '../../domain/value-objects/conversion-event';
import { RetryPolicy } from '../../domain/value-objects/retry-policy';

function fakeDelegate() {
  const rows: any[] = [];
  return {
    rows,
    delegate: {
      upsert: async ({ where, create, update }: any) => {
        const idx = rows.findIndex((r) => r.id === create.id);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...update };
        else rows.push(create);
      },
      findFirst: async ({ where }: any) =>
        rows.find((r) => r.destinationId === where.destinationId && r.eventId === where.eventId) ??
        null,
    },
  };
}

describe('PrismaPostbackRepository', () => {
  it('serializes the frozen ConversionEvent snapshot and round-trips status', async () => {
    const { delegate, rows } = fakeDelegate();
    const repo = new PrismaPostbackRepository(delegate as any);
    const pb = Postback.create({
      id: 'p1',
      destinationId: 'd1',
      event: ConversionEvent.create({ eventName: 'Purchase', eventId: 'e1', eventTimeMs: 1 }),
      retryPolicy: RetryPolicy.default(),
    });
    await repo.save(pb);
    expect(rows[0].eventId).toBe('e1');
    expect(rows[0].status).toBe('PENDING');
    expect(rows[0].eventSnapshot.eventName).toBe('Purchase');
    const found = await repo.findByDedup('d1', 'e1');
    expect(found?.status).toBe('PENDING');
    expect(found?.eventId).toBe('e1');
  });
});
