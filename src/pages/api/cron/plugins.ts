import type { APIRoute } from "astro";
import { withCronAuth, jsonResponse } from "@/lib/api-helpers";
import { runPluginCrons } from "@/composition/plugin-runtime";

// Node deployments have no scheduled handler; an external scheduler hits this every 5 minutes.
// Each plugin cron still honours its own interval, so calling it more often is harmless.
export const POST: APIRoute = withCronAuth(async () => jsonResponse({ ran: await runPluginCrons() }));

export const GET: APIRoute = withCronAuth(async (context) => POST(context));
