// The job-handler registry is a per-isolate singleton (import.meta.glob wiring at boot).
// Pass `locals` when an inline (waitUntil) dispatch is needed; cron callers omit it (CRON_POLL only).
import { getTenantPrisma } from "../modules/platform/infra/prisma-tenant-extension";
import { getBasePrisma } from "../lib/db";
import { getCurrentTenantId } from "../lib/tenant/context";
import { InProcessJobHandlerRegistry } from "../modules/platform/infra/registries/job-handler-registry";
import { InProcessHookRegistry } from "../modules/platform/infra/registries/hook-registry";
import { InProcessMcpServer } from "../modules/platform/infra/registries/mcp-server";
import { CfWaitUntilExecutionAdapter } from "../modules/platform/infra/cf-wait-until";
import { PrismaJobRepository } from "../modules/platform/infra/prisma/job.repository";
import { PrismaConfigRepository } from "../modules/platform/infra/prisma/config.repository";
import { OutboxEventPublisher } from "../modules/platform/infra/outbox-event-publisher";
import { EnvConfigAdapter } from "../modules/platform/infra/env-config.adapter";
import { EnqueueJobService } from "../modules/platform/application/enqueue-job.service";
import { RunJobService } from "../modules/platform/application/run-job.service";
import { PollPendingJobsService } from "../modules/platform/application/poll-pending-jobs.service";
import { GetEffectiveConfigService, SetConfigService } from "../modules/platform/application/config.service";
import type { JobHandler } from "../modules/platform/application/ports";

const RETRY_POLICY = { baseMs: 5_000, factor: 2, maxMs: 3_600_000 };
const handlerRegistry = new InProcessJobHandlerRegistry();
const hookRegistry = new InProcessHookRegistry();
const mcpServer = new InProcessMcpServer();

export function registerJobHandler(kind: string, handler: JobHandler): void {
  if (!handlerRegistry.has(kind)) handlerRegistry.register(kind, handler);
}

const tenantPort = { current: () => getCurrentTenantId() };

export function makePlatform(locals?: { cfContext?: { waitUntil(p: Promise<unknown>): void } }) {
  const db = getTenantPrisma();
  const base = getBasePrisma();
  const jobRepo = new PrismaJobRepository(db);
  const configRepo = new PrismaConfigRepository(db);
  const deferred = new CfWaitUntilExecutionAdapter(locals ?? {});
  const env = new EnvConfigAdapter();
  const eventPublisher = new OutboxEventPublisher(base);

  const runJob = new RunJobService(jobRepo, handlerRegistry, RETRY_POLICY);
  const enqueueJob = new EnqueueJobService(jobRepo, handlerRegistry, deferred, tenantPort, runJob);
  const pollPendingJobs = new PollPendingJobsService(jobRepo, runJob, { batchSize: 50, leaseMs: 30_000 });
  const getEffectiveConfig = new GetEffectiveConfigService(configRepo, env, tenantPort);
  const setConfig = new SetConfigService(configRepo, tenantPort);

  return { enqueueJob, runJob, pollPendingJobs, getEffectiveConfig, setConfig, eventPublisher, handlerRegistry, hookRegistry, mcpServer };
}
