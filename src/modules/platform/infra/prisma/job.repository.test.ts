import { describe, it, expect, vi } from "vitest";
import { PrismaJobRepository } from "./job.repository";

const fakeClient = () => ({
  job: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async ({ data }: any) => ({ id: "job_1", ...data })),
  },
  $queryRawUnsafe: vi.fn(async (_sql: string) => [{ id: "a" }, { id: "b" }]),
});

describe("PrismaJobRepository", () => {
  it("insertPending maps the row and returns the new jobId", async () => {
    const c = fakeClient();
    const repo = new PrismaJobRepository(c as any);
    const out = await repo.insertPending({
      tenantId: "default", kind: "outbox.drain", payload: { n: 1 }, dispatch: "CRON_POLL",
      idempotencyKey: null, runAfter: new Date(0), maxAttempts: 3,
    });
    expect(out.jobId).toBe("job_1");
    expect(c.job.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ kind: "outbox.drain", status: "PENDING" }) }));
  });

  it("claimBatch issues a FOR UPDATE SKIP LOCKED query and returns ids", async () => {
    const c = fakeClient();
    const repo = new PrismaJobRepository(c as any);
    const ids = await repo.claimBatch(new Date(0), 5, 30000);
    expect(ids).toEqual(["a", "b"]);
    const sql = c.$queryRawUnsafe.mock.calls[0]![0] as unknown as string;
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/i);
  });

  it("claimBatch reclaims RUNNING jobs whose lease expired, bounded by maxAttempts", async () => {
    const c = fakeClient();
    const repo = new PrismaJobRepository(c as any);
    await repo.claimBatch(new Date(0), 5, 30000);
    const sql = c.$queryRawUnsafe.mock.calls[0]![0] as unknown as string;
    expect(sql).toMatch(/status = 'PENDING'/i);
    expect(sql).toMatch(/status = 'RUNNING' AND "leaseExpiry" IS NOT NULL AND "leaseExpiry" < \$1/i);
    expect(sql).toMatch(/"attemptCount" < "maxAttempts"/i);
  });
});
