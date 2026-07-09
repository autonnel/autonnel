import type { ArmCounts, ExperimentResultsReadPort } from '../../application/ports';
import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';

const PAID_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED'];

// Arm membership lives in ab_test_assignments (trackingId == visitorId). Conversions read from the
// surviving sources: paid orders (order goal) or raw activity events (step_reached goal).
export class PrismaExperimentResultsRepository implements ExperimentResultsReadPort {
  constructor(_db?: unknown) {}

  async countByArm(input: {
    experimentId: string;
    armIds: string[];
    since: Date | null;
    goal: { kind: 'order' } | { kind: 'step_reached'; stepId: string };
  }): Promise<ArmCounts[]> {
    const db = getBasePrisma();
    const tenantId = getCurrentTenantId();
    const results: ArmCounts[] = [];

    for (const armId of input.armIds) {
      const params: unknown[] = [tenantId, input.experimentId, armId];
      let sinceClause = '';
      if (input.since) {
        params.push(input.since);
        sinceClause = ` AND a."createdAt" >= $${params.length}`;
      }

      const enteredRows = await db.$queryRawUnsafe<Array<{ n: number }>>(
        `SELECT COUNT(DISTINCT a."trackingId")::int AS n FROM "ab_test_assignments" a
         WHERE a."tenantId" = $1 AND a."experimentId" = $2 AND a."armId" = $3${sinceClause}`,
        ...params,
      );
      const entered = Number(enteredRows[0]?.n ?? 0);

      let converted = 0;
      if (input.goal.kind === 'order') {
        const r = await db.$queryRawUnsafe<Array<{ n: number }>>(
          `SELECT COUNT(DISTINCT a."trackingId")::int AS n
           FROM "ab_test_assignments" a
           JOIN "orders" o ON o."tenantId" = a."tenantId"
             AND o."attribution"->>'visitorId' = a."trackingId"
             AND o."status"::text = ANY($${params.length + 1})
           WHERE a."tenantId" = $1 AND a."experimentId" = $2 AND a."armId" = $3${sinceClause}`,
          ...params,
          PAID_STATUSES,
        );
        converted = Number(r[0]?.n ?? 0);
      } else {
        const r = await db.$queryRawUnsafe<Array<{ n: number }>>(
          `SELECT COUNT(DISTINCT a."trackingId")::int AS n
           FROM "ab_test_assignments" a
           JOIN "user_activity_events" e ON e."tenantId" = a."tenantId"
             AND e."visitorId" = a."trackingId" AND e."stepId" = $${params.length + 1}
           WHERE a."tenantId" = $1 AND a."experimentId" = $2 AND a."armId" = $3${sinceClause}`,
          ...params,
          input.goal.stepId,
        );
        converted = Number(r[0]?.n ?? 0);
      }

      results.push({ armId, entered, converted });
    }
    return results;
  }
}
