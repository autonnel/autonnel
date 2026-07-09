import { defineRoute, ApiError } from '@/lib/api/define-route';
import {
  ConfigKeys,
  getConversionAnalysisPrompt,
  getConversionAnalysisFrequencyMinutes,
  getLastConversionAnalysisResult,
} from '@/lib/config/keys';
import { setConfig, deleteConfig } from '@/lib/config/get-config';
import type { AiConversionAnalysisWire, AiConversionAnalysisLastResult } from '@/contracts/settings';

const MIN_FREQUENCY = 30;
const MAX_FREQUENCY = 1440;
const DEFAULT_FREQUENCY = 120;

export const GET = defineRoute('GET /api/settings/ai-conversion-analysis', { feature: 'SETTINGS_AI_CONVERSION_ANALYSIS' }, async (): Promise<AiConversionAnalysisWire> => {
  const [prompt, freq, lastResult] = await Promise.all([
    getConversionAnalysisPrompt().catch(() => undefined),
    getConversionAnalysisFrequencyMinutes().catch(() => undefined),
    getLastConversionAnalysisResult().catch(() => undefined),
  ]);
  let frequencyMinutes = typeof freq === 'number' ? freq : DEFAULT_FREQUENCY;
  if (!Number.isFinite(frequencyMinutes)) frequencyMinutes = DEFAULT_FREQUENCY;
  return {
    prompt: typeof prompt === 'string' ? prompt : '',
    frequencyMinutes,
    lastResult: (lastResult as AiConversionAnalysisLastResult | undefined) ?? null,
  };
});

export const PUT = defineRoute('PUT /api/settings/ai-conversion-analysis', { feature: 'SETTINGS_AI_CONVERSION_ANALYSIS' }, async ({ input }) => {
  const body = input ?? {};
  const ops: Array<Promise<unknown>> = [];

  if ('prompt' in body) {
    const v = body.prompt;
    if (v === null || v === '') {
      ops.push(deleteConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT.key));
    } else if (typeof v === 'string') {
      ops.push(setConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT.key, v));
    } else {
      throw new ApiError(400, 'prompt must be string or null');
    }
  }

  if ('frequencyMinutes' in body) {
    const v = body.frequencyMinutes;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < MIN_FREQUENCY || v > MAX_FREQUENCY) {
      throw new ApiError(400, `frequencyMinutes must be an integer between ${MIN_FREQUENCY} and ${MAX_FREQUENCY}`);
    }
    ops.push(setConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_FREQUENCY_MINUTES.key, v));
  }

  await Promise.all(ops);
  return { ok: true } as const;
});

export const DELETE = defineRoute('DELETE /api/settings/ai-conversion-analysis', { feature: 'SETTINGS_AI_CONVERSION_ANALYSIS' }, async () => {
  await Promise.all([
    deleteConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT.key),
    deleteConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_FREQUENCY_MINUTES.key),
  ]);
  return { success: true } as const;
});
