import type { APIContext, APIRoute } from "astro";
import { z } from "zod";
import type { ZodType } from "zod";
import { requireFeature } from "@/modules/identity/published/principal";
import { withApiPrincipal, requireWriteAccess } from "@/composition/external-auth";
import { PageDashboardError } from "@/modules/authoring/application/page-dashboard-service";
import { FunnelNotFoundError } from "@/modules/funnel-dashboard/application/manage-funnels.service";
import { FunnelStepError } from "@/modules/authoring/domain/funnel";
import { CommerceNotConfiguredError } from "@/composition/make-commerce-gateway";
import { UnsafeUrlError, ResponseTooLargeError } from "@/lib/utils/safe-url";
import { StorageNotConfiguredError } from "@/lib/s3";
import { createLogger } from "@/lib/logger";
import { McpRequestError } from "./tool-errors";
import { allToolDefinitions } from "./tools";

const logger = createLogger("McpRestBridge");

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Unwraps .optional()/.nullable()/.default()/.prefault() to the schema zod actually validates
// the value against, so coercion sees "number"/"array"/etc. instead of always "optional". All
// four wrapper classes publicly expose `.unwrap()` - no need to reach into internals for this.
function unwrap(schema: ZodType): ZodType {
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault ||
    current instanceof z.ZodPrefault
  ) {
    // .unwrap()'s generic default is the looser `core.$ZodType`; every schema here is built
    // through the classic `z.xxx()` API, so it's always actually a `ZodType` at runtime.
    current = current.unwrap() as ZodType;
  }
  return current;
}

function coerceScalar(schema: ZodType, raw: string): unknown {
  const leaf = unwrap(schema);
  if (leaf.type === "number") {
    if (raw === "") return raw;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (leaf.type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return raw;
  }
  // Anything else - string, enum, etc. - is left untouched. This is what makes an all-digit
  // string field (e.g. a "search" order number like "20260227001") survive as a string instead
  // of being guessed into a number and rejected by the schema.
  return raw;
}

// Query strings are all-strings; coercion is driven by the tool's own schema (per field, after
// unwrapping) rather than guessed from the value, so a field typed z.string() never gets
// reinterpreted as a number, and a field typed z.array(...) collects every repeated `?key=`
// occurrence instead of the last one silently winning.
function coerceQuery(url: URL, inputSchema: ZodType): Record<string, unknown> {
  const shape = inputSchema instanceof z.ZodObject ? (inputSchema.shape as Record<string, ZodType>) : {};
  const out: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const fieldSchema = shape[key];
    if (!fieldSchema) {
      out[key] = url.searchParams.get(key) ?? "";
      continue;
    }
    const leaf = unwrap(fieldSchema);
    if (leaf instanceof z.ZodArray) {
      // Same generic-default note as unwrap()'s cast above.
      out[key] = url.searchParams.getAll(key).map((v) => coerceScalar(leaf.element as ZodType, v));
    } else {
      out[key] = coerceScalar(fieldSchema, url.searchParams.get(key) ?? "");
    }
  }
  return out;
}

async function readArguments(context: APIContext, inputSchema: ZodType): Promise<Record<string, unknown> | null> {
  const base =
    context.request.method === "GET"
      ? coerceQuery(context.url, inputSchema)
      : await context.request
          .text()
          .then((t) => (t.trim() === "" ? {} : (JSON.parse(t) as Record<string, unknown>)))
          .catch(() => null);
  if (base === null) return null;
  // Path params are authoritative: /pages/abc must not be redirected by a body pageId.
  const params = Object.fromEntries(
    Object.entries(context.params).filter(([, v]) => v !== undefined),
  );
  return { ...base, ...params };
}

/**
 * Exposes one MCP tool as a REST route so the two surfaces cannot drift: same zod schema,
 * same handler, same feature and writeAccess gate. Only the error envelope differs — REST
 * answers with HTTP status codes, MCP with JSON-RPC error objects.
 */
export function toolRoute(toolName: string, opts: { status?: number } = {}): APIRoute {
  const definition = allToolDefinitions().find((t) => t.name === toolName);
  if (!definition) throw new Error(`toolRoute: unknown tool "${toolName}"`);

  return (context) =>
    withApiPrincipal(context, async (principal) => {
      requireFeature(definition.requiredFeature);
      if (definition.writeAccess) requireWriteAccess(principal);

      const args = await readArguments(context, definition.inputSchema);
      if (args === null) return json({ error: "Invalid JSON body" }, 400);

      const parsed = definition.inputSchema.safeParse(args);
      if (!parsed.success) {
        return json(
          {
            error: `Invalid arguments for ${toolName}`,
            issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          },
          400,
        );
      }

      try {
        const result = await definition.handler(parsed.data, { locals: context.locals });
        return json(result, opts.status ?? 200);
      } catch (err) {
        // McpRequestError, FunnelStepError and CommerceNotConfiguredError are all caller-fixable
        // failures the tools throw (bad template key, invalid step slug, no ecommerce backend
        // connected) - errors.ts maps all three to an MCP InvalidRequest for the same reason.
        // Without these branches they fall to the 500 below and read as a server fault.
        if (err instanceof UnsafeUrlError) return json({ error: err.message }, 400);
        if (err instanceof ResponseTooLargeError) return json({ error: err.message }, 400);
        if (err instanceof McpRequestError) return json({ error: err.message }, 400);
        if (err instanceof FunnelStepError) return json({ error: err.message }, 400);
        if (err instanceof CommerceNotConfiguredError) return json({ error: err.message }, 400);
        if (err instanceof PageDashboardError) return json({ error: err.message }, err.status);
        if (err instanceof FunnelNotFoundError) return json({ error: err.message }, 404);
        if (err instanceof StorageNotConfiguredError) return json({ error: err.message, code: err.code }, 412);
        logger.error("Tool route failed", { error: err, tool: toolName });
        return json({ error: "Internal error" }, 500);
      }
    }) as Promise<Response>;
}
