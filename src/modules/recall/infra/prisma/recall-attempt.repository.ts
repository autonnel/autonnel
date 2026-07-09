// Due-batch claim uses FOR UPDATE SKIP LOCKED + a lease so concurrent cron isolates never double-fire.
import type { PrismaClient } from '@prisma/client';
import { Prisma as P } from '@prisma/client';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { RecallAttempt, type Touch } from '../../domain/recall-attempt';
import { AttemptStatus } from '../../domain/value-objects';
import type { RecallAttemptRepository } from '../../application/ports';

const LEASE_SECONDS = 120;

type Row = {
  id: string; checkoutRef: string; campaignRef: string; campaignVersionRef: number;
  status: string; nextStepIndex: number; contact: any; incentiveRef: string | null;
  frequencyCapMax: number; enrolledAt: Date; touches?: any[];
};

function toDomain(row: Row): RecallAttempt {
  const a = RecallAttempt.enroll({
    checkoutRef: row.checkoutRef,
    campaignRef: row.campaignRef,
    campaignVersionRef: row.campaignVersionRef,
    contact: row.contact,
    incentiveRef: row.incentiveRef ?? undefined,
    frequencyCapMaxTouches: row.frequencyCapMax,
  });
  a.id = row.id;
  a.status = AttemptStatus.of(row.status as any);
  a.nextStepIndex = row.nextStepIndex;
  (a as unknown as { enrolledAt: Date }).enrolledAt = row.enrolledAt;
  if (row.touches) {
    for (const t of row.touches) {
      (a as unknown as { _touches: Touch[] })._touches.push({
        touchId: t.touchId, stepIndex: t.stepIndex, channel: t.channel,
        scheduledFor: t.scheduledFor, firedAt: t.firedAt,
        messageHandoffRef: t.messageHandoffRef, deliveryOutcome: t.deliveryOutcome, engagementOutcome: t.engagementOutcome,
      });
    }
  }
  return a;
}

export class PrismaRecallAttemptRepository implements RecallAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByDedupeKey(checkoutRef: string, campaignRef: string): Promise<RecallAttempt | null> {
    const row = await (this.prisma as any).recallAttempt.findUnique({
      where: { tenantId_dedupeKey: { tenantId: getCurrentTenantId(), dedupeKey: `${checkoutRef}::${campaignRef}` } } as any,
      include: { touches: true },
    });
    return row ? toDomain(row as Row) : null;
  }

  async findByCheckoutRef(checkoutRef: string): Promise<RecallAttempt[]> {
    const rows = await (this.prisma as any).recallAttempt.findMany({ where: { checkoutRef }, include: { touches: true } });
    return (rows as Row[]).map(toDomain);
  }

  async save(attempt: RecallAttempt): Promise<RecallAttempt> {
    const enrolledAt = (attempt as unknown as { enrolledAt?: Date }).enrolledAt ?? new Date();
    const data = {
      checkoutRef: attempt.checkoutRef,
      campaignRef: attempt.campaignRef,
      campaignVersionRef: attempt.campaignVersionRef,
      dedupeKey: attempt.dedupeKey,
      status: attempt.status.value,
      nextStepIndex: attempt.nextStepIndex,
      contact: attempt.contact as any,
      incentiveRef: attempt.incentiveRef ?? null,
      frequencyCapMax: attempt.frequencyCapMaxTouches,
      enrolledAt,
    };
    const row = attempt.id
      ? await (this.prisma as any).recallAttempt.update({ where: { id: attempt.id }, data, include: { touches: true } })
      : await (this.prisma as any).recallAttempt.create({ data, include: { touches: true } });
    // Persist fired touches (idempotent upsert on the (attempt, touchId) unique key).
    for (const t of attempt.touches) {
      await (this.prisma as any).recallTouch.upsert({
        where: { tenantId_attemptId_touchId: { tenantId: getCurrentTenantId(), attemptId: row.id, touchId: t.touchId } } as any,
        create: { attemptId: row.id, touchId: t.touchId, stepIndex: t.stepIndex, channel: t.channel, scheduledFor: t.scheduledFor, firedAt: t.firedAt, messageHandoffRef: t.messageHandoffRef, deliveryOutcome: t.deliveryOutcome, engagementOutcome: t.engagementOutcome },
        update: { firedAt: t.firedAt, messageHandoffRef: t.messageHandoffRef, deliveryOutcome: t.deliveryOutcome, engagementOutcome: t.engagementOutcome },
      });
    }
    return toDomain({ ...(row as Row), enrolledAt });
  }

  async claimDueBatch(now: Date, limit: number): Promise<RecallAttempt[]> {
    const leaseUntil = new Date(now.getTime() + LEASE_SECONDS * 1000);
    const tenantId = getCurrentTenantId();
    return (this.prisma as any).$transaction(async (tx: any) => {
      // Raw SQL bypasses the tenant Prisma extension, so the tenant clause is explicit here.
      const claimed: { id: string }[] = await tx.$queryRaw(
        P.sql`SELECT id FROM "recall_attempts"
              WHERE "tenantId" = ${tenantId}
                AND "status" = 'active'
                AND ("nextDueAt" IS NULL OR "nextDueAt" <= ${now})
                AND ("leaseUntil" IS NULL OR "leaseUntil" <= ${now})
              ORDER BY "nextDueAt" ASC NULLS FIRST
              LIMIT ${limit}
              FOR UPDATE SKIP LOCKED`,
      );
      const ids = claimed.map((r) => r.id);
      if (ids.length === 0) return [];
      await tx.recallAttempt.updateMany({ where: { id: { in: ids } }, data: { leaseUntil } });
      const rows = await tx.recallAttempt.findMany({ where: { id: { in: ids } }, include: { touches: true } });
      return (rows as Row[]).map(toDomain);
    });
  }
}
