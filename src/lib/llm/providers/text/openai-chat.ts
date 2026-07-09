import { fetchWithRetry } from '../../http';
import type { TextInput, TextOutput, TextProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export const openaiChatProvider: TextProvider = {
  id: 'openai-chat',
  async generateText(input: TextInput, model: LlmModel): Promise<TextOutput> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: input.modelId,
      messages: input.messages,
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;
    if (input.response_format) body.response_format = input.response_format;
    if (input.maxTokens !== undefined) body.max_tokens = input.maxTokens;
    if (input.reasoning_effort) body.reasoning_effort = input.reasoning_effort;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
    };
    const organization = model.options?.organization;
    if (typeof organization === 'string' && organization) {
      headers['OpenAI-Organization'] = organization;
    }

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as OpenAIChatResponse;
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error('OpenAI Chat response missing choices[0].message.content');
    }
    return { content, raw: json };
  },
};
