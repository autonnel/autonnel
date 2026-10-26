import ssrHandler from "@astrojs/cloudflare/entrypoints/server";
import "virtual:autonnel/runtime-plugins";
import { setRuntimeEnv } from "./lib/runtime/env";
import { runWithRequestDb, disposeRequestDb } from "./lib/db";
import { runScheduled } from "./composition/scheduled-tick";

// autonnel-saas dynamic-imports this entry for runScheduled.
export { runScheduled };

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
  async scheduled(event: { cron?: string } | undefined, env: Record<string, unknown>): Promise<void> {
    setRuntimeEnv(env);
    await runWithRequestDb(async () => {
      try {
        await runScheduled(env, event?.cron);
      } finally {
        await disposeRequestDb();
      }
    });
  },
};
