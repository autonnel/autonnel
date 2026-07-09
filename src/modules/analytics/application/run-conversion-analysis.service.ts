export interface ConversionDataset {
  timeRange: string;
  windowStart: string;
  windowEnd: string;
  sessionsAnalyzed: number;
  conversions: number;
  conversionRate: number;
  ordersCount: number;
  paidOrders: number;
  revenue: number;
  currencyCode: string;
  funnelBreakdown: Array<{ funnelId: string; sessions: number; conversions: number }>;
}

export interface ConversionAnalysisResult {
  runAt: string;
  timeRange: string;
  sessionsAnalyzed: number;
  summary: string;
  analysis: string;
  hasLlmInsights: boolean;
  severity?: 'low' | 'medium' | 'high';
  flaggedFunnels?: Array<{ funnelId: string; name: string; reason: string }>;
  recommendations?: string[];
  investigated?: boolean;
}

export interface ConversionAnalyzeInput {
  dataset: ConversionDataset;
  baseline: ConversionDataset | null;
  summary: string;
  deep: boolean;
}

export interface ConversionAnalyzeOutput {
  analysis: string;
  severity?: 'low' | 'medium' | 'high';
  flaggedFunnels?: Array<{ funnelId: string; name: string; reason: string }>;
  recommendations?: string[];
}

export interface ConversionAnalysisDeps {
  clock: () => Date;
  config: {
    getFrequencyMinutes(): Promise<number | undefined>;
    getLastRunAt(): Promise<Date | null>;
    getUserPrompt(): Promise<string | undefined>;
    setLastRunAt(d: Date): Promise<void>;
    setLastResult(r: ConversionAnalysisResult): Promise<void>;
  };
  data: { collect(windowStart: Date, windowEnd: Date): Promise<ConversionDataset> };
  llm: {
    isConfigured(): Promise<boolean>;
    analyze(input: ConversionAnalyzeInput): Promise<ConversionAnalyzeOutput>;
  };
  events: { publishCompleted(r: ConversionAnalysisResult): Promise<void> };
  onError?(err: unknown): void;
}

const MAX_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_BASELINE_SESSIONS = 20;
const CVR_RELATIVE_DROP = 0.3;
const REVENUE_RELATIVE_DROP = 0.5;
const ZERO_PAID_MIN_SESSIONS = 20;

export function buildConversionSummary(d: ConversionDataset): string {
  const rate = `${(d.conversionRate * 100).toFixed(2)}%`;
  const lines = [
    `Period: ${d.timeRange}`,
    `Sessions: ${d.sessionsAnalyzed}`,
    `Conversions: ${d.conversions} (${rate})`,
    `Orders: ${d.ordersCount} (paid: ${d.paidOrders})`,
    `Revenue: ${d.currencyCode} ${d.revenue.toFixed(2)}`,
  ];
  if (d.funnelBreakdown.length > 0) {
    lines.push('Top funnels:');
    for (const f of d.funnelBreakdown) {
      lines.push(`  - ${f.funnelId}: ${f.sessions} sessions, ${f.conversions} conversions`);
    }
  }
  return lines.join('\n');
}

// Deterministic, cheap triage. An anomaly escalates the LLM run from a light
// single-shot narrative to a tool-using deep dive. Baseline-relative checks only
// fire when the baseline window carries meaningful traffic.
export function detectConversionAnomaly(
  current: ConversionDataset,
  baseline: ConversionDataset | null,
): { anomaly: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (current.paidOrders === 0 && current.sessionsAnalyzed >= ZERO_PAID_MIN_SESSIONS) {
    reasons.push(`No paid orders across ${current.sessionsAnalyzed} sessions.`);
  }

  if (baseline && baseline.sessionsAnalyzed >= MIN_BASELINE_SESSIONS) {
    if (baseline.conversionRate > 0) {
      const drop = (baseline.conversionRate - current.conversionRate) / baseline.conversionRate;
      if (drop >= CVR_RELATIVE_DROP) {
        reasons.push(
          `Conversion rate dropped ${(drop * 100).toFixed(0)}% vs the prior window ` +
            `(${(baseline.conversionRate * 100).toFixed(2)}% → ${(current.conversionRate * 100).toFixed(2)}%).`,
        );
      }
    }
    if (baseline.revenue > 0) {
      const drop = (baseline.revenue - current.revenue) / baseline.revenue;
      if (drop >= REVENUE_RELATIVE_DROP) {
        reasons.push(
          `Revenue dropped ${(drop * 100).toFixed(0)}% vs the prior window ` +
            `(${baseline.currencyCode} ${baseline.revenue.toFixed(2)} → ${current.revenue.toFixed(2)}).`,
        );
      }
    }
  }

  return { anomaly: reasons.length > 0, reasons };
}

export class RunConversionAnalysisService {
  constructor(private readonly deps: ConversionAnalysisDeps) {}

  async run(opts?: { force?: boolean }): Promise<{ ran: boolean; reason?: string; result?: ConversionAnalysisResult }> {
    const freq = await this.deps.config.getFrequencyMinutes();
    if (typeof freq !== 'number' || !Number.isFinite(freq)) return { ran: false, reason: 'disabled' };

    const now = this.deps.clock();
    const lastRunAt = await this.deps.config.getLastRunAt();
    if (!opts?.force && lastRunAt && now.getTime() < lastRunAt.getTime() + freq * 60_000) {
      return { ran: false, reason: 'not-due' };
    }

    const rawStart = lastRunAt ?? new Date(now.getTime() - freq * 60_000);
    const windowStart = new Date(Math.max(rawStart.getTime(), now.getTime() - MAX_WINDOW_MS));
    const dataset = await this.deps.data.collect(windowStart, now);
    const summary = buildConversionSummary(dataset);

    if (dataset.sessionsAnalyzed === 0 && dataset.ordersCount === 0) {
      const result: ConversionAnalysisResult = {
        runAt: now.toISOString(),
        timeRange: dataset.timeRange,
        sessionsAnalyzed: 0,
        summary,
        analysis: '',
        hasLlmInsights: false,
        severity: 'low',
        investigated: false,
      };
      await this.deps.config.setLastResult(result);
      await this.deps.config.setLastRunAt(now);
      return { ran: true, result };
    }

    const windowMs = now.getTime() - windowStart.getTime();
    const baselineStart = new Date(Math.max(windowStart.getTime() - windowMs, now.getTime() - MAX_WINDOW_MS));
    const baseline =
      baselineStart.getTime() < windowStart.getTime()
        ? await this.deps.data.collect(baselineStart, windowStart)
        : null;

    const triage = detectConversionAnomaly(dataset, baseline);
    const deep = triage.anomaly;

    let analysis = '';
    let hasLlmInsights = false;
    let severity: ConversionAnalysisResult['severity'];
    let flaggedFunnels: ConversionAnalysisResult['flaggedFunnels'];
    let recommendations: ConversionAnalysisResult['recommendations'];

    if (await this.deps.llm.isConfigured()) {
      try {
        const out = await this.deps.llm.analyze({ dataset, baseline, summary, deep });
        analysis = out.analysis ?? '';
        hasLlmInsights = analysis.trim().length > 0;
        severity = out.severity;
        flaggedFunnels = out.flaggedFunnels;
        recommendations = out.recommendations;
      } catch (err) {
        this.deps.onError?.(err);
        analysis = '';
        hasLlmInsights = false;
      }
    }

    const result: ConversionAnalysisResult = {
      runAt: now.toISOString(),
      timeRange: dataset.timeRange,
      sessionsAnalyzed: dataset.sessionsAnalyzed,
      summary,
      analysis,
      hasLlmInsights,
      severity,
      flaggedFunnels,
      recommendations,
      investigated: deep && analysis.length > 0,
    };

    await this.deps.config.setLastResult(result);
    await this.deps.config.setLastRunAt(now);

    if (dataset.sessionsAnalyzed > 0 || dataset.ordersCount > 0) {
      await this.deps.events.publishCompleted(result);
    }

    return { ran: true, result };
  }
}
