import type { APIRoute } from "astro";
import { withCronAuth, jsonResponse } from "@/lib/api-helpers";
import { getBasePrisma } from "@/lib/db";
import { makePlatform } from "@/composition/make-platform";
import { OutboxDrainService } from "@/modules/platform/infra/outbox-event-publisher";
import { registerAllJobHandlers } from "@/composition/register-job-handlers";
import { makeEventDelivery } from "@/composition/make-event-delivery";
import { createLogger } from "@/lib/logger";

const logger = createLogger("CronDrain");

// Dev/on-demand trigger: astro dev runs no scheduled worker, so this runs the same
// jobs-then-outbox pass the CF cron does, letting a running server deliver pending events.
export const POST: APIRoute = withCronAuth(async ({ locals }) => {
  registerAllJobHandlers();
  const platform = makePlatform(locals as { cfContext?: { waitUntil(p: Promise<unknown>): void } });
  const jobsRan = await platform.pollPendingJobs.poll();
  const outboxDrained = await new OutboxDrainService(getBasePrisma(), makeEventDelivery(locals)).drain();
  logger.info("manual drain complete", { jobsRan, outboxDrained });
  return jsonResponse({ jobsRan, outboxDrained });
});

export const GET: APIRoute = withCronAuth(async (context) => POST(context));
