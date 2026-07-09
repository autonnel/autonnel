// claimBatch uses FOR UPDATE SKIP LOCKED + a lease so concurrent cron isolates never double-claim.
// It also reclaims RUNNING jobs whose lease expired (a prior runner died mid-handler, e.g. a CF
// isolate suspended after the response or a dev-server restart) so orphaned jobs drain on retry.
// Tenant injection is bypassed for the claim (cross-tenant drain) by using a raw query;
// insert/load go through the tenant-scoped client.
import { Job, type JobSnapshot } from "../../domain/job";
import type { JobRow, JobRepositoryPort } from "../../application/ports";
import type { JobStorePort } from "../../application/run-job.service";

type Client = ReturnType<typeof import("../prisma-tenant-extension").getTenantPrisma>;

export class PrismaJobRepository implements JobRepositoryPort, JobStorePort {
  constructor(private readonly db: Client | any) {}

  async findByIdempotency(tenantId: string, kind: string, key: string) {
    const row = await this.db.job.findFirst({
      where: { tenantId, kind, idempotencyKey: key },
      select: { id: true, status: true },
    });
    return row ? { jobId: row.id, status: row.status as string } : null;
  }

  async insertPending(row: JobRow): Promise<{ jobId: string }> {
    try {
      const created = await this.db.job.create({
        data: {
          tenantId: row.tenantId,
          kind: row.kind,
          payload: row.payload as object,
          dispatch: row.dispatch,
          status: "PENDING",
          idempotencyKey: row.idempotencyKey,
          runAfter: row.runAfter,
          maxAttempts: row.maxAttempts,
        },
      });
      return { jobId: created.id };
    } catch (err) {
      // Concurrent enqueue won the unique([tenantId, kind, idempotencyKey]) race.
      if ((err as { code?: string }).code === "P2002" && row.idempotencyKey) {
        const existing = await this.findByIdempotency(row.tenantId, row.kind, row.idempotencyKey);
        if (existing) return { jobId: existing.jobId };
      }
      throw err;
    }
  }

  async requeue(jobId: string, runAfter: Date): Promise<void> {
    await this.db.job.update({
      where: { id: jobId },
      data: { status: "PENDING", runAfter, leaseExpiry: null, result: null, failureReason: null, attemptCount: 0 },
    });
  }

  async claimBatch(now: Date, limit: number, leaseMs: number): Promise<string[]> {
    const sql = `
      WITH claimed AS (
        SELECT id FROM jobs
        WHERE "runAfter" <= $1
          AND "attemptCount" < "maxAttempts"
          AND (
            status = 'PENDING'
            OR (status = 'RUNNING' AND "leaseExpiry" IS NOT NULL AND "leaseExpiry" < $1)
          )
        ORDER BY "runAfter" ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE jobs SET status = 'RUNNING',
        "attemptCount" = "attemptCount" + 1,
        "leaseExpiry" = $3
      WHERE id IN (SELECT id FROM claimed)
      RETURNING id`;
    const rows = (await this.db.$queryRawUnsafe(sql, now, limit, new Date(now.getTime() + leaseMs))) as { id: string }[];
    return rows.map((r) => r.id);
  }

  async load(jobId: string): Promise<Job | null> {
    const r = await this.db.job.findUnique({ where: { id: jobId } });
    if (!r) return null;
    const snap: JobSnapshot = {
      id: r.id, tenantId: r.tenantId, kind: r.kind, status: r.status, dispatch: r.dispatch,
      payload: r.payload, result: r.result ?? null, externalRef: r.externalRef ?? null,
      idempotencyKey: r.idempotencyKey ?? null, attemptCount: r.attemptCount, maxAttempts: r.maxAttempts,
      runAfter: r.runAfter, leaseExpiry: r.leaseExpiry ?? null, failureReason: r.failureReason ?? null,
    };
    return Job.rehydrate(snap);
  }

  async save(job: Job): Promise<void> {
    const s = job.snapshot();
    await this.db.job.update({
      where: { id: s.id },
      data: {
        status: s.status, attemptCount: s.attemptCount, runAfter: s.runAfter,
        leaseExpiry: s.leaseExpiry, result: (s.result as object) ?? undefined,
        externalRef: s.externalRef, failureReason: s.failureReason,
      },
    });
  }
}
