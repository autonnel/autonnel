import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createWorkersAiClient } from '@/lib/llm/providers/workers-ai';
import { WORKERS_AI_PROVIDER } from '@/lib/llm/workers-ai-config';
import { createLogger } from '@/lib/logger';

const logger = createLogger('LlmProvider');

export interface ResolvedModel {
  model: LanguageModel;
  modelId: string;
  protocol: 'anthropic' | 'openai-compatible' | 'workers-ai';
}

function isAnthropicEndpoint(provider: string, baseUrl: string): boolean {
  return provider === 'anthropic-messages' || baseUrl.toLowerCase().includes('/anthropic');
}

export async function resolveLlmModel(name?: string): Promise<ResolvedModel> {
  const row = await getLlmModel('text', name);
  if (!row) {
    throw new LlmNotConfiguredError();
  }

  const modelId = row.modelId;
  const normalizedUrl = row.baseUrl.replace(/\/+$/, '');

  if (row.provider === WORKERS_AI_PROVIDER) {
    logger.info('Creating Workers AI model', { transport: normalizedUrl ? 'rest' : 'binding', modelId });
    return { model: createWorkersAiClient(row)(modelId), modelId, protocol: 'workers-ai' };
  }

  if (isAnthropicEndpoint(row.provider, normalizedUrl)) {
    const anthropicBaseUrl = `${normalizedUrl}/v1`;
    logger.info('Creating Anthropic model for tool calling', { baseUrl: anthropicBaseUrl, modelId });
    return {
      model: createAnthropic({ baseURL: anthropicBaseUrl, apiKey: row.apiKey })(modelId),
      modelId,
      protocol: 'anthropic',
    };
  }

  logger.info('Creating OpenAI-compatible model', { baseUrl: normalizedUrl, modelId });
  return {
    // .chat(): the default call targets the Responses API, which OpenAI-compatible vendors lack.
    model: createOpenAI({ baseURL: normalizedUrl, apiKey: row.apiKey }).chat(modelId),
    modelId,
    protocol: 'openai-compatible',
  };
}
