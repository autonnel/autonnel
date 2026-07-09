import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from './errors';
import { getTextProvider } from './registry';
import type { TextMessage } from './types';

export interface CallTextOptions {
  modelName?: string;
  messages: TextMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' | 'text' };
  reasoning_effort?: string;
  maxTokens?: number;
  userId?: string;
}

export async function callText(options: CallTextOptions): Promise<string> {
  const name = options.modelName?.trim();
  const row =
    (name ? await getLlmModel('text', name) : undefined) ??
    (await getLlmModel('text'));
  if (!row) throw new LlmNotConfiguredError();

  const provider = getTextProvider(row.provider);
  const out = await provider.generateText(
    {
      modelId: row.modelId,
      messages: options.messages,
      temperature: options.temperature,
      response_format: options.response_format,
      reasoning_effort: options.reasoning_effort,
      maxTokens: options.maxTokens,
      userId: options.userId,
    },
    row,
  );
  return out.content;
}

export async function isLlmConfigured(): Promise<boolean> {
  return (await getLlmModel('text')) !== undefined;
}
