import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from '@/lib/llm/errors';
import { createLogger } from '@/lib/logger';

const logger = createLogger('LlmProvider');

export interface ResolvedModel {
  model: LanguageModel;
  modelId: string;
  protocol: 'anthropic' | 'openai-compatible';
}

function isAnthropicEndpoint(baseUrl: string): boolean {
  return baseUrl.toLowerCase().includes('/anthropic');
}

export async function resolveLlmModel(name?: string): Promise<ResolvedModel> {
  const row = await getLlmModel('text', name);
  if (!row) {
    throw new LlmNotConfiguredError();
  }

  const modelId = row.name;
  const normalizedUrl = row.baseUrl.replace(/\/+$/, '');

  if (isAnthropicEndpoint(normalizedUrl)) {
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
    model: createOpenAI({ baseURL: normalizedUrl, apiKey: row.apiKey })(modelId),
    modelId,
    protocol: 'openai-compatible',
  };
}
