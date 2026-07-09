// Astro v6 removed locals.runtime.ctx and accessing it THROWS; deferred work MUST read
// locals.cfContext.waitUntil. In Node (no cfContext) we fire-and-forget so dev works.
import type { DeferredExecutionPort } from "../application/ports";
import { createLogger } from "../../../lib/logger";

const log = createLogger("CfWaitUntil");

interface CfLocals {
  cfContext?: { waitUntil(p: Promise<unknown>): void };
}

export class CfWaitUntilExecutionAdapter implements DeferredExecutionPort {
  constructor(private readonly locals: CfLocals) {}

  run(promiseFactory: () => Promise<unknown>): void {
    const p = promiseFactory().catch((err) => log.error("deferred task failed", { error: err }));
    const waitUntil = this.locals.cfContext?.waitUntil;
    if (waitUntil) waitUntil(p);
    // else: Node fallback — the promise is already running (fire-and-forget).
  }
}
