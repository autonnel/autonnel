import { z } from "zod";
import { TEMPLATE_REGISTRY, getTemplateByValue, getTemplateData } from "@/lib/templates/registry";
import { McpRequestError } from "../tool-errors";
import type { AnyMcpToolDefinition } from "../tool-definition";
import type { TemplateDescriptor } from "@/lib/templates/types";

// The registry names fields for the builder UI; the API surface uses key/name/description
// so callers are not exposed to internal naming.
function toMeta(t: TemplateDescriptor) {
  return {
    key: t.value,
    name: t.label,
    description: t.subtitle,
    pageType: t.defaultPageType,
    section: t.section,
    defaultSlug: t.defaultSlug,
  };
}

export function pageTemplateTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "list_templates",
      title: "List page templates",
      description:
        "List the built-in Puck page templates. Use a returned key as templateKey in create_page, or pass it to get_template to read the full component JSON.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({ pageType: z.string().optional() }),
      async handler(input) {
        const wanted = input.pageType?.toUpperCase();
        const templates = TEMPLATE_REGISTRY.filter(
          (t) => !wanted || String(t.defaultPageType).toUpperCase() === wanted,
        ).map(toMeta);
        return { templates, count: templates.length };
      },
    },
    {
      name: "get_template",
      title: "Get page template",
      description:
        "Get one page template's full Puck JSON. This JSON is the authoritative reference for which components exist and what props they accept - read it instead of inventing draftData.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({ key: z.string().min(1) }),
      async handler(input) {
        const descriptor = getTemplateByValue(input.key);
        if (!descriptor) {
          throw new McpRequestError(`Unknown template key: ${input.key}`);
        }
        return { ...toMeta(descriptor), data: getTemplateData(input.key) };
      },
    },
  ];
}
