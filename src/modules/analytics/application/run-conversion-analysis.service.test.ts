import { describe, it, expect, vi } from 'vitest';
import {
  RunConversionAnalysisService,
  buildConversionSummary,
  detectConversionAnomaly,
  type ConversionDataset,
  type ConversionAnalysisDeps,
  type ConversionAnalyzeInput,
  type ConversionAnalyzeOutput,
} from './run-conversion-analysis.service';

function dataset(overrides: Partial<ConversionDataset> = {}): ConversionDataset {
  return {
    timeRange: '2026-06-14T08:00:00.000Z – 2026-06-14T10:00:00.000Z',
    windowStart: '2026-06-14T08:00:00.000Z',
    windowEnd: '2026-06-14T10:00:00.000Z',
    sessionsAnalyzed: 40,
    conversions: 10,
    conversionRate: 0.25,
    ordersCount: 12,
    paidOrders: 10,
    revenue: 299.9,
    currencyCode: 'USD',
    funnelBreakdown: [{ funnelId: 'f1', sessions: 40, conversions: 10 }],
    ...overrides,
  };
}

function makeDeps(over: {
  freq?: number | undefined;
  lastRunAt?: Date | null;
  now?: Date;
  data?: ConversionDataset;
  llmConfigured?: boolean;
  analyze?: (input: ConversionAnalyzeInput) => Promise<ConversionAnalyzeOutput>;
  onError?: (err: unknown) => void;
}) {
  const setLastResult = vi.fn(async () => {});
  const setLastRunAt = vi.fn(async () => {});
  const publishCompleted = vi.fn(async () => {});
  const collect = vi.fn(async () => over.data ?? dataset());
  const analyze = over.analyze ?? vi.fn(async () => ({ analysis: 'LLM analysis text' }));
  const onError = over.onError ?? vi.fn();
  const deps: ConversionAnalysisDeps = {
    clock: () => over.now ?? new Date('2026-06-14T10:00:00.000Z'),
    config: {
      getFrequencyMinutes: async () => over.freq,
      getLastRunAt: async () => over.lastRunAt ?? null,
      getUserPrompt: async () => undefined,
      setLastRunAt,
      setLastResult,
    },
    data: { collect },
    llm: { isConfigured: async () => over.llmConfigured ?? true, analyze },
    events: { publishCompleted },
    onError,
  };
  return { deps, setLastResult, setLastRunAt, publishCompleted, collect, analyze, onError };
}

describe('RunConversionAnalysisService', () => {
  it('is disabled when frequency is not configured', async () => {
    const { deps, collect } = makeDeps({ freq: undefined });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out).toEqual({ ran: false, reason: 'disabled' });
    expect(collect).not.toHaveBeenCalled();
  });

  it('skips when not due and not forced', async () => {
    const { deps } = makeDeps({
      freq: 120,
      lastRunAt: new Date('2026-06-14T09:30:00.000Z'),
      now: new Date('2026-06-14T10:00:00.000Z'),
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.ran).toBe(false);
    expect(out.reason).toBe('not-due');
  });

  it('runs, persists result + lastRunAt, and publishes when there is data', async () => {
    const { deps, setLastResult, setLastRunAt, publishCompleted } = makeDeps({
      freq: 120,
      lastRunAt: new Date('2026-06-14T07:00:00.000Z'),
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.ran).toBe(true);
    expect(out.result?.hasLlmInsights).toBe(true);
    expect(out.result?.analysis).toBe('LLM analysis text');
    expect(setLastResult).toHaveBeenCalledTimes(1);
    expect(setLastRunAt).toHaveBeenCalledTimes(1);
    expect(publishCompleted).toHaveBeenCalledTimes(1);
  });

  it('threads structured fields from analyze into the result', async () => {
    const { deps } = makeDeps({
      freq: 120,
      lastRunAt: null,
      analyze: vi.fn(async () => ({
        analysis: 'narrative',
        severity: 'high' as const,
        flaggedFunnels: [{ funnelId: 'f1', name: 'Main', reason: 'cvr drop' }],
        recommendations: ['fix the checkout'],
      })),
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.result?.severity).toBe('high');
    expect(out.result?.flaggedFunnels).toEqual([{ funnelId: 'f1', name: 'Main', reason: 'cvr drop' }]);
    expect(out.result?.recommendations).toEqual(['fix the checkout']);
  });

  it('marks hasLlmInsights false and calls onError when the LLM throws', async () => {
    const onError = vi.fn();
    const { deps, setLastResult } = makeDeps({
      freq: 120,
      lastRunAt: null,
      onError,
      analyze: vi.fn(async () => {
        throw new Error('llm down');
      }),
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.ran).toBe(true);
    expect(out.result?.hasLlmInsights).toBe(false);
    expect(out.result?.analysis).toBe('');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(setLastResult).toHaveBeenCalledTimes(1);
  });

  it('skips the LLM entirely and does not publish when there is no traffic', async () => {
    const { deps, setLastResult, setLastRunAt, publishCompleted, analyze } = makeDeps({
      freq: 120,
      lastRunAt: null,
      data: dataset({ sessionsAnalyzed: 0, conversions: 0, ordersCount: 0, paidOrders: 0, funnelBreakdown: [] }),
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.ran).toBe(true);
    expect(out.result?.severity).toBe('low');
    expect(out.result?.investigated).toBe(false);
    expect(analyze).not.toHaveBeenCalled();
    expect(setLastResult).toHaveBeenCalledTimes(1);
    expect(setLastRunAt).toHaveBeenCalledTimes(1);
    expect(publishCompleted).not.toHaveBeenCalled();
  });

  it('escalates analyze to deep mode when triage flags an anomaly', async () => {
    const analyze = vi.fn(async (_input: ConversionAnalyzeInput): Promise<ConversionAnalyzeOutput> => ({
      analysis: 'deep narrative',
    }));
    const { deps } = makeDeps({
      freq: 120,
      lastRunAt: null,
      now: new Date('2026-06-14T10:00:00.000Z'),
      analyze,
    });
    // current window: high CVR; baseline: equal-length prior window with a much higher CVR.
    deps.data.collect = vi.fn(async (start: Date) => {
      const isBaseline = start.getTime() < new Date('2026-06-14T08:00:00.000Z').getTime();
      return isBaseline
        ? dataset({ sessionsAnalyzed: 100, conversions: 40, conversionRate: 0.4 })
        : dataset({ sessionsAnalyzed: 100, conversions: 10, conversionRate: 0.1 });
    });
    const out = await new RunConversionAnalysisService(deps).run();
    expect(out.ran).toBe(true);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(analyze.mock.calls[0][0].deep).toBe(true);
    expect(out.result?.investigated).toBe(true);
  });

  it('force bypasses the not-due gate', async () => {
    const { deps, collect } = makeDeps({
      freq: 120,
      lastRunAt: new Date('2026-06-14T09:55:00.000Z'),
      now: new Date('2026-06-14T10:00:00.000Z'),
    });
    const out = await new RunConversionAnalysisService(deps).run({ force: true });
    expect(out.ran).toBe(true);
    // current + baseline window collected.
    expect(collect).toHaveBeenCalled();
  });
});

describe('detectConversionAnomaly', () => {
  it('flags a conversion-rate drop vs a meaningful baseline', () => {
    const current = dataset({ sessionsAnalyzed: 100, conversionRate: 0.1, paidOrders: 5, revenue: 100 });
    const baseline = dataset({ sessionsAnalyzed: 100, conversionRate: 0.4, paidOrders: 30, revenue: 600 });
    const out = detectConversionAnomaly(current, baseline);
    expect(out.anomaly).toBe(true);
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  it('returns no anomaly when current matches baseline (flat)', () => {
    const current = dataset({ sessionsAnalyzed: 100, conversionRate: 0.25, paidOrders: 25, revenue: 500 });
    const baseline = dataset({ sessionsAnalyzed: 100, conversionRate: 0.25, paidOrders: 25, revenue: 500 });
    const out = detectConversionAnomaly(current, baseline);
    expect(out.anomaly).toBe(false);
  });

  it('does not flag a drop when there is no baseline', () => {
    const current = dataset({ sessionsAnalyzed: 100, conversionRate: 0.01, paidOrders: 1, revenue: 10 });
    const out = detectConversionAnomaly(current, null);
    expect(out.anomaly).toBe(false);
  });

  it('does not use baseline-relative checks when baseline traffic is too small', () => {
    const current = dataset({ sessionsAnalyzed: 5, conversionRate: 0.01, paidOrders: 1, revenue: 10 });
    const baseline = dataset({ sessionsAnalyzed: 5, conversionRate: 0.5, paidOrders: 3, revenue: 600 });
    const out = detectConversionAnomaly(current, baseline);
    expect(out.anomaly).toBe(false);
  });

  it('flags zero paid orders with meaningful sessions even without a baseline', () => {
    const current = dataset({ sessionsAnalyzed: 40, conversions: 0, conversionRate: 0, paidOrders: 0, revenue: 0 });
    const out = detectConversionAnomaly(current, null);
    expect(out.anomaly).toBe(true);
    expect(out.reasons[0]).toContain('No paid orders');
  });
});

describe('buildConversionSummary', () => {
  it('renders deterministic counts and rate', () => {
    const s = buildConversionSummary(dataset());
    expect(s).toContain('Sessions: 40');
    expect(s).toContain('Conversions: 10 (25.00%)');
    expect(s).toContain('Revenue: USD 299.90');
    expect(s).toContain('- f1: 40 sessions, 10 conversions');
  });
});
