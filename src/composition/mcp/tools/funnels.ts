import { z } from "zod";
import { makeFunnelDashboard } from "@/composition/make-funnel-dashboard";
import { createFunnelWithDefaults } from "@/composition/create-funnel-with-defaults";
import { authoringDepsFromLocals } from "@/composition/authoring-runtime";
import { FunnelNotFoundError } from "@/modules/funnel-dashboard/application/manage-funnels.service";
import type { AnyMcpToolDefinition, McpToolContext } from "../tool-definition";

// A step is exactly { stepSlug, pageId } (src/modules/authoring/domain/funnel.ts). Order is
// array position and a step's funnel role is the referenced page's own `type`; there is no
// stored pageType, order, subOrder, or step id.
interface RawStep {
  stepSlug?: string;
  pageId?: string;
}

function db(ctx: McpToolContext) {
  return authoringDepsFromLocals(ctx.locals).db;
}

async function readSteps(ctx: McpToolContext, funnelId: string): Promise<RawStep[]> {
  const row = await db(ctx).funnel.findUnique({ where: { id: funnelId }, select: { id: true, steps: true } });
  if (!row) throw new FunnelNotFoundError(funnelId);
  return Array.isArray(row.steps) ? (row.steps as RawStep[]) : [];
}

function toSummary(f: {
  id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: f.id,
    name: f.name,
    description: f.description,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

export function funnelTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "list_funnels",
      title: "List funnels",
      description:
        "List the tenant's funnels with a step count each. Use get_funnel for the step list and the entry step slug.",
      requiredFeature: "FUNNELS",
      writeAccess: false,
      inputSchema: z.object({
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).optional(),
      }),
      async handler(input, ctx) {
        const all = await makeFunnelDashboard().funnels.list();
        const page = input.page ?? 1;
        const limit = Math.min(100, input.limit ?? 50);
        const slice = all.slice((page - 1) * limit, page * limit);
        // One batched query for the whole page's steps instead of one findUnique per funnel.
        const rows = slice.length
          ? await db(ctx).funnel.findMany({
              where: { id: { in: slice.map((f) => f.id) } },
              select: { id: true, steps: true },
            })
          : [];
        const stepCountById = new Map(
          rows.map((r) => [r.id, Array.isArray(r.steps) ? (r.steps as RawStep[]).length : 0]),
        );
        const funnels = slice.map((f) => ({
          ...toSummary(f),
          stepCount: stepCountById.get(f.id) ?? 0,
        }));
        return {
          funnels,
          pagination: {
            page,
            limit,
            total: all.length,
            totalPages: Math.max(1, Math.ceil(all.length / limit)),
          },
        };
      },
    },
    {
      name: "get_funnel",
      title: "Get funnel",
      description:
        "Get one funnel with its ordered steps. Each step is { stepSlug, pageId, page }; the step's role in the flow is page.type. entryStepSlug is the first step - its URL is /n/{funnelId}/{stepSlug}.",
      requiredFeature: "FUNNELS",
      writeAccess: false,
      inputSchema: z.object({ funnelId: z.string().min(1) }),
      async handler(input, ctx) {
        const summary = await makeFunnelDashboard().funnels.get(input.funnelId);
        const rawSteps = await readSteps(ctx, input.funnelId);
        const pageIds = rawSteps.map((s) => s.pageId).filter((id): id is string => Boolean(id));
        const pages = pageIds.length
          ? await db(ctx).page.findMany({
              where: { id: { in: pageIds } },
              select: { id: true, slug: true, name: true, type: true, status: true },
            })
          : [];
        const byId = new Map(pages.map((p) => [p.id, p]));
        // Step order is the array order; an orphaned step (page deleted) is preserved with
        // page: null so callers can see and repair it.
        const steps = rawSteps.map((s) => ({
          stepSlug: s.stepSlug ?? null,
          pageId: s.pageId ?? null,
          page: s.pageId ? byId.get(s.pageId) ?? null : null,
        }));
        return { ...toSummary(summary), entryStepSlug: steps[0]?.stepSlug ?? null, steps };
      },
    },
    {
      name: "create_funnel",
      title: "Create funnel",
      description:
        "Create a funnel. Steps for the tenant's thank-you and error pages are added automatically, creating those pages from templates if none exist. Attach landing, checkout and upsell pages with add_funnel_page.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({
          name: z.string().min(1),
          description: z.string().optional(),
        })
        .strict(),
      async handler(input, ctx) {
        const funnel = await createFunnelWithDefaults({
          name: input.name,
          description: input.description,
          locals: ctx.locals,
        });
        return toSummary(funnel);
      },
    },
    {
      name: "update_funnel",
      title: "Update funnel",
      description: "Rename a funnel or change its description.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({
          funnelId: z.string().min(1),
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
        })
        .strict(),
      async handler(input) {
        const patch: { name?: string; description?: string | null } = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.description !== undefined) patch.description = input.description;
        return toSummary(await makeFunnelDashboard().funnels.update(input.funnelId, patch));
      },
    },
    {
      name: "delete_funnel",
      title: "Delete funnel",
      description:
        "Delete a funnel. The pages it referenced are not deleted - they stay available to other funnels.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z.object({ funnelId: z.string().min(1) }).strict(),
      async handler(input) {
        await makeFunnelDashboard().funnels.remove(input.funnelId);
        return { deleted: true, funnelId: input.funnelId };
      },
    },
  ];
}
