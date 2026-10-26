import { setRuntimeEnv } from "../lib/runtime/env";
import { runWithTenant, getCurrentTenantId } from "../lib/tenant/context";
import { DEFAULT_TENANT } from "../modules/shared-kernel";
import { makePlatform } from "./make-platform";
import { OutboxDrainService } from "../modules/platform/infra/outbox-event-publisher";
import { getBasePrisma } from "../lib/db";
import { createLogger } from "../lib/logger";
import { runCatalogSyncSweep } from "../modules/commerce-gateway/infra/cron-handlers";
import { makeCommerceCronDeps } from "./make-commerce-gateway";
import { makePaymentsReconcile, makeDeferredCaptureDeps } from "./make-payments";
import { runPaymentReconcileSweep } from "../modules/payments/application/reconcile-cron";
import { runDeferredCaptureSweep } from "../modules/payments/application/capture-deferred-cron";
import { reconcilePendingHostedUpsells, runStripeMergedHandoffSweep } from "./make-upsell";
import { runMessagingRetrySweep } from "./make-messaging";
import { makeAcquisitionAds } from "./make-acquisition-ads";
import { createAdsDepsForRequest } from "./make-ads-deps";
import { registerRecallCron } from "../modules/recall/infra/cron/process-due-touches.cron";
import { makeRecall } from "./make-recall";
import { createRecallDepsForCron } from "./make-recall-deps";
import { makeOrderFulfillment } from "./make-order-fulfillment";
import { buildOrderFulfillmentCronDeps } from "./order-fulfillment-cron-deps";
import { registerAllJobHandlers } from "./register-job-handlers";
import { makeEventDelivery } from "./make-event-delivery";
import { runMaintenanceSweeps } from "./run-maintenance-sweeps";
import { runConversionAnalysisSweep } from "./analytics/run-conversion-analysis";
import { runSweep } from "../lib/cron/run-sweep";
import { runPluginCrons } from "./plugin-runtime";

const log = createLogger("Scheduled");

async function runCommerceSweeps(): Promise<void> {
  const deps = makeCommerceCronDeps();
  await runCatalogSyncSweep({ makeSyncCatalogService: deps.makeSyncCatalogService, pageSize: 100 });
}

// One scheduled tick, shared by the Workers `scheduled` handler and the Node in-process scheduler.
// `trigger` is the cron expression of the invocation (undefined for manual runs).
export async function runScheduled(env: Record<string, unknown>, trigger?: string): Promise<void> {
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
      // Before the merged push sweep so a paid hosted-page upsell is part of the pushed order.
      const hosted = await reconcilePendingHostedUpsells();
      if (hosted.captured || hosted.errors) log.info("orders.hosted-upsell swept", hosted);
    });

    // Abandoned Stripe merged upsells: enqueue the held single ecommerce push (drained by the poll below).
    await runSweep("ecommerce.push-retry", async () => {
      const swept = await runStripeMergedHandoffSweep();
      if (swept.pushed || swept.failed) log.info("ecommerce.merged-push swept", swept);
    });

    // Retryable conversion postbacks: re-enqueue the due PENDING ones so the poll below dispatches
    // them in this same tick. Without this sweep the ONLY driver is the HTTP /api/cron/postbacks
    // endpoint, so a Cloudflare deployment with no external scheduler never retries a postback.
    await runSweep("ads.postback", async () => {
      const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
      const swept = await ads.retrySweep.retrySweep({ limit: 100 });
      if (swept.processed) log.info("ads.postback swept", swept);
    });

    // The job poll fans out across multiple catalog jobs (ads.postback / ecommerce / media image),
    // so it runs error-isolated but unlocked rather than under a single sweep lock.
    const ran = await runSweep("jobs.poll", () => pollPendingJobs.poll());

    await runSweep("analytics.conversion", async () => {
      const ca = await runConversionAnalysisSweep();
      if (ca.ran) log.info("analytics.conversion swept", { sessions: ca.result?.sessionsAnalyzed });
    });

    // Hourly spend/click reporting sync. Without this sweep a Cloudflare deployment with no
    // external scheduler never pulls insights: the HTTP /api/cron/ad-insights endpoint is the
    // only other driver, and it depends on the operator wiring one up themselves.
    await runSweep("ads.insights", async () => {
      const ads = await makeAcquisitionAds(await createAdsDepsForRequest());
      const swept = await ads.syncInsights.syncAll();
      if (swept.connections) log.info("ads.insights swept", { ...swept });
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

    const pluginCronsRan = await runPluginCrons(trigger);
    if (pluginCronsRan) log.info("plugin crons swept", { ran: pluginCronsRan });

    await runSweep("maintenance.jobs", async () => {
      const swept = await runMaintenanceSweeps();
      if (swept.jobs || swept.dispatch || swept.engagement) log.info("maintenance cleanup swept", swept);
    });

    log.info("scheduled tick complete", { jobsRan: ran ?? 0, outboxDrained: drained ?? 0 });
  });
}
