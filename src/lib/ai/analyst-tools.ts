import { tool } from 'ai';
import { z } from 'zod';

export interface AnalystFunnelListItem {
  funnelId: string;
  name: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
}

export interface AnalystFunnelMetrics {
  funnelId: string;
  stages: Array<{
    key: string;
    label: string;
    value: number;
    conversionPct: number | null;
    dropPct: number | null;
  }>;
  upsells: Array<{ key: string; label: string; value: number; ofOrdersPct: number | null }>;
  revenue: number;
  orders: number;
  visitors: number;
  overallCvr: number | null;
  aov: number | null;
}

export interface AnalystOrdersResult {
  statusBreakdown: Record<string, number>;
  paidOrders: number;
  ordersCount: number;
  revenue: number;
  aov: number | null;
  refunds: number;
  sample: Array<{
    orderNumber: string;
    status: string;
    amount: number;
    currencyCode: string;
    createdAt: string;
  }>;
}

export interface AnalystPageContent {
  editorType: string;
  components?: Array<{ type: string; text?: string }>;
  html?: string;
}

export interface AnalystScreenshotArgs {
  funnelId?: string;
  step?: string;
  pageId?: string;
}

export interface AnalystOrdersArgs {
  status?: string;
  limit?: number;
}

// All data access is injected so the tools are unit-testable without a DB.
// The deps own every read; the tools only orchestrate + format. The optional
// `screenshot` field gates the screenshotPage tool (omitted when Browser
// Rendering is unconfigured).
export interface AnalystToolsDeps {
  listFunnels(): Promise<AnalystFunnelListItem[]>;
  funnelMetrics(funnelId: string): Promise<AnalystFunnelMetrics | null>;
  queryOrders(args: AnalystOrdersArgs): Promise<AnalystOrdersResult>;
  resolvePageScreenshotUrl(args: AnalystScreenshotArgs): Promise<string | null>;
  getPageContent(pageId: string): Promise<AnalystPageContent | null>;
  screenshot?: (url: string) => Promise<{ base64: string; contentType: string }>;
}

const MAX_HTML_CHARS = 8000;

export function createAnalystTools(deps: AnalystToolsDeps) {
  const getFunnelList = tool({
    description:
      'List all funnels in the analysis window with their session count, conversions, and conversion rate. Use this first to decide which funnel to investigate.',
    inputSchema: z.object({}),
    execute: async () => {
      const funnels = await deps.listFunnels();
      return { funnels };
    },
  });

  const getFunnelMetrics = tool({
    description:
      'Get per-step funnel metrics for one funnel: page views by step, payment actions, payment results, revenue, and drop-off per transition. Call getFunnelList first to obtain a funnelId.',
    inputSchema: z.object({
      funnelId: z.string().describe('The funnel id from getFunnelList.'),
    }),
    execute: async ({ funnelId }: { funnelId: string }) => {
      const metrics = await deps.funnelMetrics(funnelId);
      if (!metrics) return { error: `funnel ${funnelId} not found` };
      return metrics;
    },
  });

  const getOrders = tool({
    description:
      'Query orders for the window: status breakdown, paid orders, order count, revenue, AOV, refunds, and a small sample. Read-only.',
    inputSchema: z.object({
      status: z.string().optional().describe('Optional order status filter, e.g. PAID, REFUNDED.'),
      limit: z.number().int().positive().max(50).optional().describe('Max sample rows to return.'),
    }),
    execute: async ({ status, limit }: AnalystOrdersArgs) => {
      return deps.queryOrders({ status, limit });
    },
  });

  const getPageContent = tool({
    description:
      'Inspect a page structure by id. For PUCK pages returns the component list (types + key text props); for GRAPESJS returns trimmed HTML. Read-only.',
    inputSchema: z.object({
      pageId: z.string(),
    }),
    execute: async ({ pageId }: { pageId: string }) => {
      const content = await deps.getPageContent(pageId);
      if (!content) return { error: `page ${pageId} not found` };
      if (content.html && content.html.length > MAX_HTML_CHARS) {
        return { ...content, html: content.html.slice(0, MAX_HTML_CHARS) };
      }
      return content;
    },
  });

  const tools: Record<string, any> = {
    getFunnelList,
    getFunnelMetrics,
    getOrders,
    getPageContent,
  };

  if (deps.screenshot) {
    const takeScreenshot = deps.screenshot;
    const screenshotPage = tool({
      description:
        "Take a screenshot of one of this tenant's OWN published funnel pages. Provide either { funnelId, step? } or { pageId }. The page URL is resolved server-side — you cannot screenshot arbitrary URLs.",
      inputSchema: z.object({
        funnelId: z.string().optional(),
        step: z.string().optional().describe('Step slug within the funnel; defaults to the first/landing step.'),
        pageId: z.string().optional(),
      }),
      execute: async ({ funnelId, step, pageId }: AnalystScreenshotArgs) => {
        if (!funnelId && !pageId) {
          return { error: 'Provide funnelId (with optional step) or pageId.' };
        }
        const url = await deps.resolvePageScreenshotUrl({ funnelId, step, pageId });
        if (!url) return { error: 'Could not resolve a published page URL for this funnel/page.' };
        const { base64, contentType } = await takeScreenshot(url);
        return { url, base64, contentType };
      },
      // ai-sdk v6: return the captured image to the model as a multimodal
      // content part so a vision model can actually see the screenshot.
      toModelOutput: (out: { output: unknown }) => {
        const result = out.output as { base64?: string; contentType?: string; error?: string };
        if (!result?.base64) {
          return { type: 'error-text', value: result?.error ?? 'screenshot failed' };
        }
        return {
          type: 'content',
          value: [{ type: 'image-data', data: result.base64, mediaType: result.contentType || 'image/png' }],
        };
      },
    });
    tools.screenshotPage = screenshotPage;
  }

  return { tools };
}
