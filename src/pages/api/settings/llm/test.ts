import { defineRoute, ApiError } from '@/lib/api/define-route';
import { listLlmModels } from '@/lib/config/llm-models';
import { LLM_MODEL_TYPES, type LlmModel, type LlmModelType } from '@/lib/config/llm-models-types';
import { createLogger } from '@/lib/logger';
import '@/lib/llm';
import { getTextProvider, getImageProvider, getVideoProvider } from '@/lib/llm/registry';
import { UnknownProviderError } from '@/lib/llm/errors';
import { pollJob } from '@/lib/llm/poll';
import type { LlmTestInput, LlmTestResult } from '@/contracts/settings';

const logger = createLogger('LlmTestAPI');

const TEST_IMAGE_MIME = 'image/png';
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGElEQVR42mNkYGD4z0AEYBxVSF+FABJWAQ87Pia0AAAAAElFTkSuQmCC';
const TEST_IMAGE_DATA_URL = `data:${TEST_IMAGE_MIME};base64,${TEST_IMAGE_BASE64}`;

interface ResolvedProbe {
  type: LlmModelType;
  provider: string;
  name: string;
  modelId: string;
  baseUrl: string;
  apiKey: string;
  options?: Record<string, unknown>;
}

async function resolve(body: LlmTestInput | null): Promise<ResolvedProbe> {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'Invalid body');
  if (typeof body.type !== 'string' || !(LLM_MODEL_TYPES as readonly string[]).includes(body.type)) {
    throw new ApiError(400, 'type must be text | image | video');
  }
  if (typeof body.provider !== 'string' || !body.provider.trim()) throw new ApiError(400, 'provider required');
  if (typeof body.name !== 'string' || !body.name.trim()) throw new ApiError(400, 'name required');
  if (typeof body.modelId !== 'string' || !body.modelId.trim()) throw new ApiError(400, 'modelId required');
  if (typeof body.baseUrl !== 'string' || !body.baseUrl.trim()) throw new ApiError(400, 'baseUrl required');
  if (typeof body.apiKey !== 'string') throw new ApiError(400, 'apiKey must be string');
  if (body.options !== undefined && (typeof body.options !== 'object' || body.options === null || Array.isArray(body.options))) {
    throw new ApiError(400, 'options must be an object when provided');
  }

  let apiKey = body.apiKey;
  if (apiKey === '') {
    const existing = (await listLlmModels()).find((r) => r.type === body.type && r.name === body.name);
    apiKey = existing?.apiKey ?? '';
    if (!apiKey) throw new ApiError(400, 'apiKey required when no stored row to fall back to');
  }

  return {
    type: body.type,
    provider: body.provider.trim(),
    name: body.name.trim(),
    modelId: body.modelId.trim(),
    baseUrl: body.baseUrl.trim().replace(/\/+$/, ''),
    apiKey,
    options: body.options,
  };
}

function failure(err: unknown): LlmTestResult {
  if (err instanceof UnknownProviderError) return { ok: false, error: err.message };
  logger.warn('LLM test failed', { error: err });
  return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
}

export const POST = defineRoute('POST /api/settings/llm/test', { feature: 'SETTINGS_LLM' }, async ({ input }): Promise<LlmTestResult> => {
  const parsed = await resolve(input);
  const probeModel: LlmModel = {
    type: parsed.type,
    provider: parsed.provider,
    name: parsed.name,
    modelId: parsed.modelId,
    baseUrl: parsed.baseUrl,
    apiKey: parsed.apiKey,
    options: parsed.options,
  };

  if (parsed.type === 'image') {
    try {
      const provider = getImageProvider(parsed.provider);
      const outputs = await provider.generateImage(
        { prompt: 'test', aspectRatio: '1:1', inputImageBase64: TEST_IMAGE_BASE64, inputImageMimeType: TEST_IMAGE_MIME },
        probeModel,
      );
      if (!outputs.length) return { ok: false, error: 'Provider returned no outputs' };
      return { ok: true };
    } catch (err) {
      return failure(err);
    }
  }

  if (parsed.type === 'video') {
    try {
      const provider = getVideoProvider(parsed.provider);
      const { id } = await provider.createJob({ prompt: 'test', aspectRatio: '1:1', image: TEST_IMAGE_DATA_URL }, probeModel);
      const job = await pollJob(provider, id, probeModel, { intervalMs: 3000, timeoutMs: 600_000 });
      if (job.status !== 'succeeded') {
        return { ok: false, error: job.error ?? `Job ended with status: ${job.status}` };
      }
      return { ok: true };
    } catch (err) {
      return failure(err);
    }
  }

  try {
    const provider = getTextProvider(parsed.provider);
    await provider.generateText({ modelId: parsed.modelId, messages: [{ role: 'user', content: 'ping' }], maxTokens: 1 }, probeModel);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
});
