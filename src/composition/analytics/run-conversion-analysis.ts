import { getBasePrisma } from '@/lib/db';
import { getCurrentTenantId } from '@/lib/tenant/context';
import { OutboxEventPublisher } from '@/modules/platform/infra/outbox-event-publisher';
import { TenantEventPublisher } from '@/modules/platform/infra/tenant-event-publisher';
import { MQEventType } from '@/lib/adapters/mq/types';
import { isLlmConfigured } from '@/lib/llm';
import { ProviderHttpError } from '@/lib/llm/errors';
import { resolveLlmModel } from '@/lib/ai/provider';
import { runAnalystAgent } from '@/lib/ai/agent';
import { createAnalystTools } from '@/lib/ai/analyst-tools';
import { buildAnalystDeps } from '@/composition/analytics/analyst-deps';
import {
  getConversionAnalysisFrequencyMinutes,
  getConversionAnalysisLastRunAt,
  getConversionAnalysisPrompt,
  setConversionAnalysisLastRunAt,
  setLastConversionAnalysisResult,
} from '@/lib/config/keys';
import { createLogger } from '@/lib/logger';
import {
  RunConversionAnalysisService,
  buildConversionSummary,
  type ConversionDataset,
  type ConversionAnalysisResult,
  type ConversionAnalyzeInput,
  type ConversionAnalyzeOutput,
} from '@/modules/analytics/application/run-conversion-analysis.service';

const logger = createLogger('ConversionAnalysis');

const CRON_MAX_STEPS = 12;

// Paid set is the conversion signal (no success event exists in user_activity_events);
// conversions/revenue come from orders, session/visitor counts from user_activity_events.
const PAID_ORDER_STATUSES = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'SHIPPED', 'DELIVERED'];

interface SessionCountRow {
  funnelId: string | null;
  sessions: number;
}
interface OrderAggRow {
  funnelId: string | null;
  status: string;
  capturedTotal: number;
  currencyCode: string | null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

async function collect(windowStart: Date, windowEnd: Date): Promise<ConversionDataset> {
  const base = getBasePrisma();
  const tenantId = getCurrentTenantId();

  const sessionSql = `
    SELECT "funnelId" AS "funnelId",
           COUNT(DISTINCT "sessionId")::int AS "sessions"
    FROM "user_activity_events"
    WHERE "tenantId" = $1
      AND "occurredAt" >= $2
      AND "occurredAt" < $3
      AND "sessionId" IS NOT NULL
    GROUP BY "funnelId"`;
  const orderSql = `
    SELECT o."attribution"->>'funnelId' AS "funnelId",
           o."status"::text AS "status",
           o."capturedTotal" AS "capturedTotal",
           o."currencyCode" AS "currencyCode"
    FROM "orders" o
    WHERE o."tenantId" = $1
      AND o."createdAt" >= $2
      AND o."createdAt" < $3`;

  const [sessionRows, orderRows] = await Promise.all([
    base
      .$queryRawUnsafe<Array<Record<string, unknown>>>(sessionSql, tenantId, windowStart, windowEnd)
      .then((rows) =>
        rows.map((r) => ({ funnelId: r.funnelId == null ? null : String(r.funnelId), sessions: toNumber(r.sessions) }) as SessionCountRow),
      )
      .catch(() => [] as SessionCountRow[]),
    base
      .$queryRawUnsafe<Array<Record<string, unknown>>>(orderSql, tenantId, windowStart, windowEnd)
      .then((rows) =>
        rows.map(
          (r) =>
            ({
              funnelId: r.funnelId == null ? null : String(r.funnelId),
              status: String(r.status),
              capturedTotal: toNumber(r.capturedTotal),
              currencyCode: r.currencyCode == null ? null : String(r.currencyCode),
            }) as OrderAggRow,
        ),
      )
      .catch(() => [] as OrderAggRow[]),
  ]);

  const sessionsAnalyzed = sessionRows.reduce((sum, r) => sum + r.sessions, 0);

  const paidSet = new Set(PAID_ORDER_STATUSES);
  const paidOrders = orderRows.filter((o) => paidSet.has(o.status));
  const conversions = paidOrders.length;
  const revenue = paidOrders.reduce((sum, o) => sum + o.capturedTotal, 0) / 100;
  const currencyCode = orderRows.find((o) => o.currencyCode)?.currencyCode ?? 'USD';

  const byFunnel = new Map<string, { sessions: number; conversions: number }>();
  for (const r of sessionRows) {
    const key = r.funnelId ?? '(none)';
    const prev = byFunnel.get(key) ?? { sessions: 0, conversions: 0 };
    prev.sessions += r.sessions;
    byFunnel.set(key, prev);
  }
  for (const o of paidOrders) {
    const key = o.funnelId ?? '(none)';
    const prev = byFunnel.get(key) ?? { sessions: 0, conversions: 0 };
    prev.conversions += 1;
    byFunnel.set(key, prev);
  }
  const funnelBreakdown = [...byFunnel.entries()]
    .map(([funnelId, v]) => ({ funnelId, ...v }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  return {
    timeRange: `${windowStart.toISOString()} – ${windowEnd.toISOString()}`,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    sessionsAnalyzed,
    conversions,
    conversionRate: sessionsAnalyzed > 0 ? conversions / sessionsAnalyzed : 0,
    ordersCount: orderRows.length,
    paidOrders: paidOrders.length,
    revenue,
    currencyCode,
    funnelBreakdown,
  };
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const BASE_SYSTEM_PROMPT =
  'You are a conversion-rate-optimization (CRO) analyst for an e-commerce funnel builder. ' +
  'Given the current analysis window summary and the prior equal-length baseline, identify the most ' +
  'likely drop-off points and notable changes, then give 2-4 concrete, prioritized recommendations to ' +
  'improve conversion. Be specific and concise. Do NOT invent data that is not present in the metrics ' +
  'or returned by your tools.';

const DEEP_SYSTEM_PROMPT =
  '\n\nYou have tools to dig deeper. Start with getFunnelList to find the worst-performing funnel, then ' +
  'inspect its per-step metrics with getFunnelMetrics, query orders with getOrders, and when useful inspect ' +
  'the landing and checkout page content (getPageContent) or screenshot a page (screenshotPage) to spot ' +
  'concrete issues. Investigate before concluding.';

const OUTPUT_CONTRACT =
  '\n\nEnd your reply with a fenced ```json block (and nothing after it) of the form:\n' +
  '```json\n' +
  '{ "severity": "low|medium|high", ' +
  '"flaggedFunnels": [{ "funnelId": "...", "name": "...", "reason": "..." }], ' +
  '"recommendations": ["...", "..."] }\n' +
  '```\n' +
  'Everything before the json block is the human-facing markdown analysis.';

interface ParsedBlock {
  severity?: 'low' | 'medium' | 'high';
  flaggedFunnels?: Array<{ funnelId: string; name: string; reason: string }>;
  recommendations?: string[];
}

const JSON_BLOCK_RE = /```json\s*([\s\S]*?)```/gi;

function extractStructured(text: string): { analysis: string; parsed: ParsedBlock } {
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  JSON_BLOCK_RE.lastIndex = 0;
  while ((m = JSON_BLOCK_RE.exec(text)) !== null) lastMatch = m;

  if (!lastMatch) return { analysis: text.trim(), parsed: {} };

  let parsed: ParsedBlock = {};
  try {
    const raw = JSON.parse(lastMatch[1].trim()) as ParsedBlock;
    parsed = {
      severity: raw.severity,
      flaggedFunnels: Array.isArray(raw.flaggedFunnels) ? raw.flaggedFunnels : undefined,
      recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : undefined,
    };
  } catch {
    parsed = {};
  }

  const analysis = (text.slice(0, lastMatch.index) + text.slice(lastMatch.index + lastMatch[0].length)).trim();
  return { analysis, parsed };
}

function baselineSummary(baseline: ConversionDataset | null): string {
  if (!baseline) return 'No comparable prior window (insufficient history).';
  return buildConversionSummary(baseline);
}

async function analyze(input: ConversionAnalyzeInput): Promise<ConversionAnalyzeOutput> {
  const { dataset, baseline, summary, deep } = input;
  const resolved = await resolveLlmModel();

  const userPrompt = await getConversionAnalysisPrompt();
  const useTools = deep && resolved.protocol === 'anthropic';

  let system = (userPrompt && userPrompt.trim() ? `${userPrompt.trim()}\n\n` : '') + BASE_SYSTEM_PROMPT;
  if (useTools) system += DEEP_SYSTEM_PROMPT;
  system += OUTPUT_CONTRACT;

  const tools = useTools ? createAnalystTools(await buildAnalystDeps()).tools : undefined;

  const content =
    `Current window (${dataset.timeRange}):\n${summary}\n\n` +
    `Prior baseline window:\n${baselineSummary(baseline)}`;

  const result = await runAnalystAgent({
    model: resolved.model,
    system,
    messages: [{ role: 'user', content }],
    tools,
    maxSteps: useTools ? CRON_MAX_STEPS : 1,
  });

  const { analysis, parsed } = extractStructured(result.text ?? '');
  return {
    analysis,
    severity: parsed.severity,
    flaggedFunnels: parsed.flaggedFunnels,
    recommendations: parsed.recommendations,
  };
}

export async function runConversionAnalysisSweep(opts?: { force?: boolean }) {
  const events = new TenantEventPublisher(new OutboxEventPublisher(getBasePrisma()));
  const service = new RunConversionAnalysisService({
    clock: () => new Date(),
    config: {
      getFrequencyMinutes: getConversionAnalysisFrequencyMinutes,
      getLastRunAt: async () => parseDate(await getConversionAnalysisLastRunAt()),
      getUserPrompt: getConversionAnalysisPrompt,
      setLastRunAt: setConversionAnalysisLastRunAt,
      setLastResult: setLastConversionAnalysisResult,
    },
    data: { collect },
    llm: { isConfigured: isLlmConfigured, analyze },
    events: {
      publishCompleted: (r: ConversionAnalysisResult) =>
        events.publish({ type: MQEventType.ANALYSIS_CONVERSION_COMPLETED, payload: r }),
    },
    onError: (err) => {
      const status = err instanceof ProviderHttpError ? err.status : undefined;
      logger.error('conversion analysis LLM failed', { error: err, status });
    },
  });

  const result = await service.run(opts);
  logger.info('conversion analysis sweep', { ran: result.ran, reason: result.reason, sessions: result.result?.sessionsAnalyzed });
  return result;
}
