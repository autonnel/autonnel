import ssrHandler from "@astrojs/cloudflare/entrypoints/server";
import { setRuntimeEnv } from "./lib/runtime/env";
import { runWithRequestDb, disposeRequestDb } from "./lib/db";
import { runWithTenant, getCurrentTenantId } from "./lib/tenant/context";
import { DEFAULT_TENANT } from "./modules/shared-kernel";
import { makePlatform } from "./composition/make-platform";
import { OutboxDrainService } from "./modules/platform/infra/outbox-event-publisher";
import { getBasePrisma } from "./lib/db";
import { createLogger } from "./lib/logger";
import { runCatalogSyncSweep } from "./modules/commerce-gateway/infra/cron-handlers";
import { makeCommerceCronDeps } from "./composition/make-commerce-gateway";
import { makePaymentsReconcile, makeDeferredCaptureDeps } from "./composition/make-payments";
import { runPaymentReconcileSweep } from "./modules/payments/application/reconcile-cron";
import { runDeferredCaptureSweep } from "./modules/payments/application/capture-deferred-cron";
import { runStripeMergedHandoffSweep } from "./composition/make-upsell";
import { runMessagingRetrySweep } from "./composition/make-messaging";
import { registerRecallCron } from "./modules/recall/infra/cron/process-due-touches.cron";
import { makeRecall } from "./composition/make-recall";
import { createRecallDepsForCron } from "./composition/make-recall-deps";
import { makeOrderFulfillment } from "./composition/make-order-fulfillment";
import { buildOrderFulfillmentCronDeps } from "./composition/order-fulfillment-cron-deps";
import { registerAllJobHandlers } from "./composition/register-job-handlers";
import { makeEventDelivery } from "./composition/make-event-delivery";
import { runMaintenanceSweeps } from "./composition/run-maintenance-sweeps";
import { runConversionAnalysisSweep } from "./composition/analytics/run-conversion-analysis";
import { runSweep } from "./lib/cron/run-sweep";

const log = createLogger("CfWorker:scheduled");

async function runCommerceSweeps(): Promise<void> {
  const deps = makeCommerceCronDeps();
  await runCatalogSyncSweep({ makeSyncCatalogService: deps.makeSyncCatalogService, pageSize: 100 });
}

export async function runScheduled(env: Record<string, unknown>): Promise<void> {
  setRuntimeEnv(env);
  await runWithTenant(DEFAULT_TENANT, async () => {
    registerAllJobHandlers();
    const { pollPendingJobs, eventPublisher } = makePlatform();
    void eventPublisher;

    // Abandoned PayPal merged upsells: capture the held order before the job poll runs the handoff.
    await runSweep("orders.auto-capture", async () => {
      const dc = makeDeferredCaptureDeps();
      const swept = await runDeferredCaptureSweep({ ...dc, cutoff: new Date(Date.now() - 20 * 60_000), limit: 50 });
      if (swept.captured || swept.failed) log.info("orders.auto-capture swept", swept);
    });

    // Abandoned Stripe merged upsells: enqueue the held single ecommerce push (drained by the poll below).
    await runSweep("ecommerce.push-retry", async () => {
      const swept = await runStripeMergedHandoffSweep();
      if (swept.pushed || swept.failed) log.info("ecommerce.merged-push swept", swept);
    });

    // The job poll fans out across multiple catalog jobs (ads.postback / ecommerce / media image),
    // so it runs error-isolated but unlocked rather than under a single sweep lock.
    const ran = await runSweep("jobs.poll", () => pollPendingJobs.poll());

    await runSweep("analytics.conversion", async () => {
      const ca = await runConversionAnalysisSweep();
      if (ca.ran) log.info("analytics.conversion swept", { sessions: ca.result?.sessionsAnalyzed });
    });

    const drained = await runSweep("outbox.drain", () =>
      new OutboxDrainService(getBasePrisma(), makeEventDelivery()).drain(),
    );

    await runSweep("commerce.catalog-sync", () => runCommerceSweeps());

    await runSweep("payment.event-compensation", () =>
      runPaymentReconcileSweep(() => makePaymentsReconcile()),
    );

    await runSweep("fulfillment.sync", async () => {
      const orderCtx = makeOrderFulfillment(await buildOrderFulfillmentCronDeps());
      const result = await orderCtx.syncFulfillmentStatus.sweep();
      log.info("order.fulfillment.sync swept", result);
    });

    await runSweep("email.dispatch", async () => {
      const result = await runMessagingRetrySweep();
      log.info("messaging.retry swept", result);
    });

    await runSweep("recall.dispatch", async () => {
      const recallCron = registerRecallCron();
      const recall = makeRecall(await createRecallDepsForCron(env, getCurrentTenantId()));
      const result = await recallCron.run(recall);
      log.info("recall.due_touch swept", result);
    });

    // Async video generation rides on the generic jobs.poll sweep above (Job.defer re-queues each poll).

    await runSweep("maintenance.jobs", async () => {
      const swept = await runMaintenanceSweeps();
      if (swept.jobs || swept.dispatch) log.info("maintenance cleanup swept", swept);
    });

    log.info("scheduled tick complete", { jobsRan: ran ?? 0, outboxDrained: drained ?? 0 });
  });
}

export default {
  async fetch(request: Request, env: Record<string, unknown>, ctx: ExecutionContext): Promise<Response> {
    setRuntimeEnv(env);
    return runWithRequestDb(async () => {
      try {
        return await ssrHandler.fetch(request as never, env as never, ctx);
      } finally {
        ctx.waitUntil(disposeRequestDb());
      }
    });
  },
  async scheduled(_event: unknown, env: Record<string, unknown>): Promise<void> {
    setRuntimeEnv(env);
    await runWithRequestDb(async () => {
      try {
        await runScheduled(env);
      } finally {
        await disposeRequestDb();
      }
    });
  },
};
