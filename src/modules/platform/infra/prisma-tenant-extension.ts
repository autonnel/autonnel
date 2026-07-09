// Deliberate exceptions (do NOT inject): the un-scoped model allowlist (global UserAccount /
// email-uniqueness + webhook-endpoint lookup) and any call with no ALS context
// (the webhook phase that verifies the signature BEFORE entering AsyncLocalStorage).
import { Prisma } from "@prisma/client";
import { tryGetTenantId } from "../../../lib/tenant/context";
import { getBasePrisma, getRequestDb } from "../../../lib/db";

const WRITE_OPS = new Set(["create", "createMany", "upsert"]);

interface InjectArgs {
  model?: string;
  operation: string;
  args: any;
  query: (args: any) => Promise<any>;
}

export function buildTenantInjector(unscopedModels: Set<string>) {
  return async function inject({ model, operation, args, query }: InjectArgs): Promise<any> {
    const tenantId = tryGetTenantId();
    if (!tenantId || !model || unscopedModels.has(model)) return query(args);

    const next = { ...args };
    if (WRITE_OPS.has(operation)) {
      if (operation === "createMany") {
        const rows = Array.isArray(next.data) ? next.data : [next.data];
        next.data = rows.map((r: any) => ({ tenantId, ...r }));
      } else if (operation === "upsert") {
        next.create = { tenantId, ...next.create };
        next.where = { ...next.where };
      } else {
        next.data = { tenantId, ...next.data };
      }
    } else {
      next.where = { tenantId, ...(next.where ?? {}) };
    }
    return query(next);
  };
}

const UNSCOPED_MODELS = new Set(["User", "ConfigEntry"]);

let moduleExtended: ReturnType<typeof makeExtended> | undefined;

function makeExtended() {
  const inject = buildTenantInjector(UNSCOPED_MODELS);
  return getBasePrisma().$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          return inject({ model, operation, args, query });
        },
      },
    },
  });
}

// Mirror getBasePrisma's request scoping: on Cloudflare cache the extended
// client per request (built on that request's base client); in Node reuse the
// module singleton.
export function getTenantPrisma() {
  const store = getRequestDb();
  if (store) return (store.tenant ??= makeExtended()) as ReturnType<typeof makeExtended>;
  if (!moduleExtended) moduleExtended = makeExtended();
  return moduleExtended;
}
