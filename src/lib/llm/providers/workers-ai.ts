import { Buffer } from 'node:buffer';
import { generateText, type ModelMessage } from 'ai';
import { createWorkersAI, type WorkersAI } from 'workers-ai-provider';
import { getBinding } from '@/lib/runtime/env';
import { createLogger } from '@/lib/logger';
import { fetchWithRetry } from '../http';
import type { LlmModel } from '@/lib/config/llm-models-types';
import {
  WORKERS_AI_BINDING, WORKERS_AI_PROVIDER, parseWorkersAiAccountId, usesWorkersAiBinding, validateWorkersAiBaseUrl,
} from '../workers-ai-config';
import type { ImageInput, ImageOutput, ImageProvider, TextInput, TextMessage, TextOutput, TextProvider } from '../types';

const logger = createLogger('Llm:workers-ai');

type WorkersAiTarget = Pick<LlmModel, 'provider' | 'baseUrl' | 'apiKey'>;

function requireBinding(): Ai {
  const binding = getBinding<Ai>(WORKERS_AI_BINDING);
  if (!binding) {
    throw new Error(`Workers AI: no "${WORKERS_AI_BINDING}" binding in this runtime. Add [ai] binding = "${WORKERS_AI_BINDING}" to wrangler.toml, or set a REST base URL and API token.`);
  }
  return binding;
}

function requireRestAccountId(model: WorkersAiTarget): string {
  const invalid = validateWorkersAiBaseUrl(model.baseUrl);
  if (invalid) throw new Error(invalid);
  if (!model.apiKey) throw new Error('Workers AI: an API token is required for the REST API');
  return parseWorkersAiAccountId(model.baseUrl)!;
}

export function createWorkersAiClient(model: WorkersAiTarget): WorkersAI {
  if (usesWorkersAiBinding(model.provider, model.baseUrl)) return createWorkersAI({ binding: requireBinding() });
  return createWorkersAI({ accountId: requireRestAccountId(model), apiKey: model.apiKey });
}

function textOf(content: TextMessage['content']): string {
  if (typeof content === 'string') return content;
  return content.map((p) => (p.type === 'text' ? p.text : '')).join('');
}

function toModelMessage(msg: TextMessage): ModelMessage {
  if (msg.role === 'system') return { role: 'system', content: textOf(msg.content) };
  if (msg.role === 'assistant') return { role: 'assistant', content: textOf(msg.content) };
  if (typeof msg.content === 'string') return { role: 'user', content: msg.content };
  return {
    role: 'user',
    content: msg.content.map((p) =>
      p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image', image: p.image_url.url }),
  };
}

export const workersAiTextProvider: TextProvider = {
  id: WORKERS_AI_PROVIDER,
  async generateText(input: TextInput, model: LlmModel): Promise<TextOutput> {
    const workersai = createWorkersAiClient(model);
    const result = await generateText({
      model: workersai(input.modelId),
      messages: input.messages.map(toModelMessage),
      temperature: input.temperature,
      maxOutputTokens: input.maxTokens,
      ...(input.reasoning_effort
        ? { providerOptions: { 'workers-ai': { reasoning_effort: input.reasoning_effort } } }
        : {}),
    });
    return { content: result.text, raw: result.response };
  },
};

const DIMS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
};

type ImageRun = (inputs: Record<string, unknown>) => Promise<unknown>;

function imageRunner(model: LlmModel): ImageRun {
  if (usesWorkersAiBinding(model.provider, model.baseUrl)) {
    const binding = requireBinding();
    return (inputs) => binding.run(model.modelId as keyof AiModels, inputs as never);
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${requireRestAccountId(model)}/ai/run/${model.modelId}`;
  return async (inputs) => {
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(inputs),
    }, { timeoutMs: 120_000 });
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.startsWith('image/')) return new Uint8Array(await res.arrayBuffer());
    const json = (await res.json()) as { result?: unknown };
    return json.result;
  };
}

// FLUX models reject width/height outright (error 5006) while SDXL honours them.
function rejectsDimensions(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('/width') && msg.includes('not allowed');
}

async function toBytes(output: unknown): Promise<Uint8Array> {
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  if (output instanceof ReadableStream) return new Uint8Array(await new Response(output).arrayBuffer());
  const image = (output as { image?: unknown } | null)?.image;
  if (typeof image === 'string') return Buffer.from(image, 'base64');
  throw new Error('Workers AI image response contained no image');
}

function sniffMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp';
  return 'image/png';
}

export const workersAiImageProvider: ImageProvider = {
  id: WORKERS_AI_PROVIDER,
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    if (input.inputImageUrl || input.inputImageBase64) {
      logger.warn('workers-ai image models are text-to-image here; ignoring input image');
    }
    const run = imageRunner(model);
    const dims = DIMS[input.aspectRatio ?? '1:1'] ?? DIMS['1:1'];
    let output: unknown;
    try {
      output = await run({ prompt: input.prompt, ...dims });
    } catch (err) {
      if (!rejectsDimensions(err)) throw err;
      output = await run({ prompt: input.prompt });
    }
    const bytes = await toBytes(output);
    return [{ type: 'base64', data: Buffer.from(bytes).toString('base64'), mimeType: sniffMime(bytes) }];
  },
};
