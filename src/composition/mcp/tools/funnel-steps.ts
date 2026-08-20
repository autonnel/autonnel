import { z } from "zod";
import { makeAuthoring } from "@/composition/make-authoring";
import { authoringDepsFromLocals } from "@/composition/authoring-runtime";
import type { AnyMcpToolDefinition, McpToolContext } from "../tool-definition";

function composing(ctx: McpToolContext) {
  return makeAuthoring(authoringDepsFromLocals(ctx.locals)).funnelComposing;
}

// .strict() so a caller passing the pageType/order fields that older docs described gets a
// validation error naming the field instead of a silently ignored argument.
export function funnelStepTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "add_funnel_page",
      title: "Add page to funnel",
      description:
        "Append a step referencing an existing page. stepSlug is required and must be unique within the funnel - it forms the step URL /n/{funnelId}/{stepSlug}. The step's role in the flow comes from the page's own type, so there is no pageType argument.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({
          funnelId: z.string().min(1),
          pageId: z.string().min(1),
          stepSlug: z.string().min(1),
        })
        .strict(),
      async handler(input, ctx) {
        await composing(ctx).addStep({
          funnelId: input.funnelId,
          pageId: input.pageId,
          stepSlug: input.stepSlug,
        });
        return { funnelId: input.funnelId, stepSlug: input.stepSlug, pageId: input.pageId };
      },
    },
    {
      name: "replace_funnel_page",
      title: "Replace page in funnel",
      description:
        "Point an existing step at a different page, keeping its slug and position. Steps are identified by the page they reference.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({
          funnelId: z.string().min(1),
          fromPageId: z.string().min(1),
          toPageId: z.string().min(1),
        })
        .strict(),
      async handler(input, ctx) {
        await composing(ctx).replaceStep({
          funnelId: input.funnelId,
          fromPageId: input.fromPageId,
          toPageId: input.toPageId,
        });
        return { funnelId: input.funnelId, fromPageId: input.fromPageId, toPageId: input.toPageId };
      },
    },
    {
      name: "remove_funnel_page",
      title: "Remove page from funnel",
      description:
        "Remove the step referencing this page. The page itself is not deleted. Works on an orphaned step whose page was already deleted.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({ funnelId: z.string().min(1), pageId: z.string().min(1) })
        .strict(),
      async handler(input, ctx) {
        await composing(ctx).removeStep({ funnelId: input.funnelId, pageId: input.pageId });
        return { removed: true, funnelId: input.funnelId, pageId: input.pageId };
      },
    },
    {
      name: "set_funnel_step_slug",
      title: "Rename funnel step slug",
      description:
        "Change an existing step's slug, which changes its /n/{funnelId}/{stepSlug} URL. The new slug must be unique within the funnel.",
      requiredFeature: "FUNNELS",
      writeAccess: true,
      inputSchema: z
        .object({
          funnelId: z.string().min(1),
          pageId: z.string().min(1),
          stepSlug: z.string().min(1),
        })
        .strict(),
      async handler(input, ctx) {
        await composing(ctx).setStepSlug({
          funnelId: input.funnelId,
          pageId: input.pageId,
          stepSlug: input.stepSlug,
        });
        return { funnelId: input.funnelId, pageId: input.pageId, stepSlug: input.stepSlug };
      },
    },
  ];
}
