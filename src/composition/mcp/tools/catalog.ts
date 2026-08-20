import { z } from "zod";
import { makeCommerceGatewayReadSide } from "@/composition/make-commerce-gateway";
import { makeAiMediaUpload } from "@/composition/make-ai-media-deps";
import { safeFetch } from "@/lib/utils/safe-url";
import { McpRequestError } from "../tool-errors";
import type { AnyMcpToolDefinition, McpToolContext } from "../tool-definition";

export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;
export const MEDIA_TIMEOUT_MS = 20_000;
export const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
] as const;

// safeFetch validates DNS, pins the connection to the resolved IP, and re-validates every
// redirect hop - this is the actual SSRF defense. The schema-level http(s)-only check on the
// input is a second layer, not a substitute.
export async function downloadMediaBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const res = await safeFetch(url, { maxBytes: MEDIA_MAX_BYTES, timeoutMs: MEDIA_TIMEOUT_MS });
  if (!res.ok) throw new McpRequestError(`Download failed with status ${res.status}: ${url}`);

  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(contentType)) {
    throw new McpRequestError(
      `Unsupported media type "${contentType || "unknown"}". Allowed: ${ALLOWED_MEDIA_TYPES.join(", ")}`,
    );
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new McpRequestError(`Download was empty: ${url}`);
  return { bytes, contentType };
}

export function catalogTools(): AnyMcpToolDefinition[] {
  return [
    {
      name: "list_products",
      title: "List products",
      description:
        "Search the connected ecommerce catalog (Shopify, WooCommerce or Picocart). Returns products with their variants for binding into checkout and upsell components.",
      requiredFeature: "PAGES",
      writeAccess: false,
      inputSchema: z.object({
        search: z.string().optional(),
        limit: z.number().int().min(1).optional(),
      }),
      async handler(input) {
        const port = await makeCommerceGatewayReadSide();
        const products = await port.searchCatalog(input.search ?? "", Math.min(250, input.limit ?? 50));
        return { products, count: products.length };
      },
    },
    {
      name: "upload_media",
      title: "Upload media from a URL",
      description:
        "Download a file from a URL and re-host it on the tenant CDN, returning the CDN URL to put in component props. Upload media before writing page content - external URLs may be blocked or disappear. Binary file upload is REST-only.",
      requiredFeature: "PAGES",
      writeAccess: true,
      inputSchema: z
        .object({
          url: z
            .string()
            .url()
            .refine((v) => /^https?:$/.test(new URL(v).protocol), {
              message: "url must be http or https",
            }),
        })
        .strict(),
      async handler(input, ctx: McpToolContext) {
        const { bytes, contentType } = await downloadMediaBytes(input.url);
        const upload = await makeAiMediaUpload({ locals: ctx.locals });
        const { assetId, url } = await upload.store({ bytes, contentType });
        return { assetId, url };
      },
    },
  ];
}
