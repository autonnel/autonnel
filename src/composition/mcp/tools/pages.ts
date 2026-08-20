import { z } from "zod";
import { makeAuthoring } from "@/composition/make-authoring";
import { authoringDepsFromLocals } from "@/composition/authoring-runtime";
import { getTemplateData } from "@/lib/templates/registry";
import { McpRequestError } from "../tool-errors";
import type { AnyMcpToolDefinition, McpToolContext } from "../tool-definition";

const PAGE_TYPES = ["checkout", "thankyou", "upsell", "error", "custom"] as const;
const EDITOR_TYPES = ["PUCK", "HTML", "GRAPESJS"] as const;

// Page type values are lowercase in the domain but legacy rows hold uppercase, so input
// is accepted in either casing and normalized down before it reaches the service.
// z.enum piped from a lowercasing transform keeps the input side as a plain z.string() for
// JSON Schema purposes (z.toJSONSchema drops `required` for a bare z.preprocess node here),
// so the five-value vocabulary is restored via .meta() instead.
const pageType = z
  .string()
  .transform((v) => v.toLowerCase())
  .pipe(z.enum(PAGE_TYPES))
  .meta({ enum: PAGE_TYPES });

function pages(ctx: McpToolContext) {
  return makeAuthoring(authoringDepsFromLocals(ctx.locals)).pageDashboard;
}

function toSummary(row: {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  editorType: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    status: row.status,
    editorType: row.editorType,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// A page's content lives in one column per editorType and the renderer reads only that column,
// so writing the other one used to return 200 at every step and still serve a blank page.
function assertContentMatchesEditor(
  page: { id: string; editorType: string },
  input: { draftData?: unknown; htmlContent?: string },
): void {
  const editorType = (page.editorType || "PUCK").toUpperCase();
  if (editorType === "PUCK") {
    if (input.htmlContent !== undefined) {
      throw new McpRequestError(
        `page ${page.id} has editorType PUCK; use draftData (Puck JSON), not htmlContent`,
      );
    }
    return;
  }
  if (input.draftData !== undefined) {
    throw new McpRequestError(
      `page ${page.id} has editorType ${editorType}; use htmlContent, not draftData`,
    );
  }
}

export function pageTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "list_pages",
      title: "List pages",
      description:
        "List the tenant's pages with pagination. Filter by search term, page type, or status. Returns each page's funnel bindings but not its content.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
        page: z.number().int().min(1).optional(),
        limit: z.number().int().min(1).optional(),
      }),
      async handler(input, ctx) {
        const result = await pages(ctx).list({
          search: input.search,
          type: input.type ? input.type.toLowerCase() : undefined,
          status: input.status,
          page: input.page ?? 1,
          perPage: Math.min(100, input.limit ?? 20),
        });
        const funnelsByPage = new Map<string, { funnelId: string; funnelName: string }[]>();
        for (const b of result.bindings) {
          const list = funnelsByPage.get(b.pageId) ?? [];
          list.push({ funnelId: b.funnelId, funnelName: b.funnelName });
          funnelsByPage.set(b.pageId, list);
        }
        return {
          pages: result.items.map((p) => ({
            ...toSummary(p),
            funnels: funnelsByPage.get(p.id) ?? [],
          })),
          pagination: {
            page: result.page,
            limit: result.perPage,
            total: result.total,
            totalPages: result.totalPages,
          },
        };
      },
    },
    {
      name: "get_page",
      title: "Get page",
      description:
        "Get one page including draftData (work in progress) and publishedData (live). Read this before editing so you preserve props you did not author.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({ pageId: z.string().min(1) }),
      async handler(input, ctx) {
        const row = await pages(ctx).get(input.pageId);
        return {
          ...toSummary(row),
          templateName: row.templateName,
          draftData: row.draftData,
          publishedData: row.publishedData,
          htmlContent: row.htmlContent,
          draftHtml: row.draftHtml,
          meta: row.meta,
          publishedAt: row.publishedAt,
        };
      },
    },
    {
      name: "create_page",
      title: "Create page",
      description:
        "Create a page. editorType defaults to PUCK, whose content is draftData (Puck JSON); pass editorType: \"HTML\" for a raw-HTML page. Pass templateKey to seed it from a page template (see list_templates), or draftData for explicit Puck JSON. The page starts as a draft; publish it with update_page. HTML content is not accepted here - create the page, then set it with a follow-up update_page call.",
      requiredFeature: "PAGES",
      writeAccess: true,
      // Strict: pageDashboard.create has no htmlContent field, so a caller passing it must be
      // rejected instead of having it silently dropped (see update_page for setting HTML content).
      inputSchema: z
        .object({
          name: z.string().min(1),
          slug: z.string().min(1),
          type: pageType,
          editorType: z.enum(EDITOR_TYPES).optional(),
          templateKey: z.string().optional(),
          draftData: z.unknown().optional(),
          meta: z.unknown().optional(),
        })
        .strict(),
      async handler(input, ctx) {
        const draftData =
          input.draftData ?? (input.templateKey ? getTemplateData(input.templateKey) : undefined);
        const row = await pages(ctx).create({
          name: input.name,
          slug: input.slug,
          type: input.type.toLowerCase(),
          editorType: input.editorType ?? "PUCK",
          templateName: input.templateKey,
          draftData,
          meta: input.meta,
        });
        return toSummary(row);
      },
    },
    {
      name: "update_page",
      title: "Update page",
      description:
        "Update a page's content or metadata. Content must match the page's editorType: draftData for PUCK pages, htmlContent for HTML pages - passing the wrong one is rejected, not silently stored. Pass publish: true to promote the draft to live and invalidate the render cache. Prefer two calls: edit, verify with get_page, then publish.",
      requiredFeature: "PAGES",
      writeAccess: true,
      inputSchema: z
        .object({
          pageId: z.string().min(1),
          name: z.string().min(1).optional(),
          slug: z.string().min(1).optional(),
          draftData: z.unknown().optional(),
          htmlContent: z.string().optional(),
          meta: z.unknown().optional(),
          publish: z.boolean().optional(),
        })
        .strict(),
      async handler(input, ctx) {
        const dashboard = pages(ctx);
        assertContentMatchesEditor(await dashboard.get(input.pageId), input);
        const patch: Record<string, unknown> = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.slug !== undefined) patch.slug = input.slug;
        if (input.draftData !== undefined) patch.draftData = input.draftData;
        if (input.htmlContent !== undefined) patch.htmlContent = input.htmlContent;
        if (input.meta !== undefined) patch.meta = input.meta;
        if (input.publish) patch.status = "PUBLISHED";
        const row = await dashboard.update(input.pageId, patch);
        return toSummary(row);
      },
    },
  ];
}
