import type { DispatchStrategy } from "../domain/job";
import type { DomainEventEnvelope } from "../../shared-kernel";

export interface JobRow {
  tenantId: string;
  kind: string;
  payload: unknown;
  dispatch: DispatchStrategy;
  idempotencyKey: string | null;
  runAfter: Date;
  maxAttempts: number;
}

export interface JobRepositoryPort {
  findByIdempotency(tenantId: string, kind: string, key: string): Promise<{ jobId: string; status: string } | null>;
  insertPending(row: JobRow): Promise<{ jobId: string }>;
  requeue(jobId: string, runAfter: Date): Promise<void>; // reset a terminal job back to PENDING
  claimBatch(now: Date, limit: number, leaseMs: number): Promise<string[]>; // returns claimed job ids
}

export interface JobHandlerRegistryPort {
  has(kind: string): boolean;
  resolve(kind: string): JobHandler | undefined;
}

export type JobHandler = (payload: unknown, ctx: JobHandlerContext) => Promise<unknown>;

export interface JobHandlerContext {
  jobId: string;
  tenantId: string;
  // Provider job id persisted by a prior poll (null on the first run). External async
  // handlers read this to resume polling instead of starting a new provider job.
  externalRef: string | null;
}

// A handler returns this to signal "external async job not finished — poll again later"
// instead of succeeding or failing. RunJobService re-queues the job via Job.defer().
export class JobDeferral {
  constructor(readonly externalRef: string | null, readonly runAfter: Date) {}
}

export function deferJob(opts: { externalRef?: string | null; runAfter: Date }): JobDeferral {
  return new JobDeferral(opts.externalRef ?? null, opts.runAfter);
}

export interface DeferredExecutionPort {
  run(promiseFactory: () => Promise<unknown>): void; // cfContext.waitUntil
}

export interface TenantContextPort {
  current(): string;
}

export interface RunJobPort {
  runById(jobId: string): Promise<void>;
  runClaimed(jobId: string): Promise<void>;
}

export interface ConfigRepositoryPort {
  get(tenantId: string, configKey: string): Promise<{ value: unknown; isSecret: boolean } | null>;
  set(row: { tenantId: string; configKey: string; value: unknown; isSecret: boolean; ownerNamespace: string | null }): Promise<void>;
}

export interface EnvConfigPort {
  read(configKey: string): unknown;
}

export interface OutboxWriterPort {
  write(event: DomainEventEnvelope, tx?: unknown): Promise<void>;
}
