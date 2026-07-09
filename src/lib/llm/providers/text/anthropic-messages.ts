import { fetchWithRetry } from '../../http';
import type { TextInput, TextMessage, TextOutput, TextProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

type AnthropicMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'url'; url: string } };

type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicMessagePart[];
};

function messageToString(content: TextMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .map((p) => (p.type === 'text' ? p.text : ''))
    .join('');
}

function translateContent(content: TextMessage['content']): AnthropicMessage['content'] {
  if (typeof content === 'string') return content;
  return content.map<AnthropicMessagePart>((p) => {
    if (p.type === 'text') return { type: 'text', text: p.text };
    return { type: 'image', source: { type: 'url', url: p.image_url.url } };
  });
}

export const anthropicMessagesProvider: TextProvider = {
  id: 'anthropic-messages',
  async generateText(input: TextInput, model: LlmModel): Promise<TextOutput> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1/messages`;

    const systemParts: string[] = [];
    const turns: AnthropicMessage[] = [];
    for (const msg of input.messages) {
      if (msg.role === 'system') {
        systemParts.push(messageToString(msg.content));
      } else {
        turns.push({ role: msg.role, content: translateContent(msg.content) });
      }
    }

    const body: Record<string, unknown> = {
      model: input.modelId,
      messages: turns,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (systemParts.length > 0) body.system = systemParts.join('\n\n');
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const anthropicVersion = typeof model.options?.anthropicVersion === 'string'
      ? (model.options.anthropicVersion as string)
      : DEFAULT_ANTHROPIC_VERSION;

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': anthropicVersion,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as AnthropicResponse;
    const content = (json.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('');
    return { content, raw: json };
  },
};
