import { fetchWithRetry } from '../../http';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBlob as fetchSafeInputImageBlob } from '@/lib/llm/safe-input-media';

interface OpenAIImageResponse {
  data?: Array<{ b64_json?: string; url?: string }>;
}

function aspectRatioToSize(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case '16:9': return '1792x1024';
    case '9:16': return '1024x1792';
    case '1:1': return '1024x1024';
    default: return '1024x1024';
  }
}

async function fetchInputImageBlob(input: ImageInput): Promise<Blob> {
  if (input.inputImageBase64 && !input.inputImageUrl) {
    const buf = Buffer.from(input.inputImageBase64, 'base64');
    return new Blob([buf], { type: input.inputImageMimeType ?? 'image/png' });
  }
  return fetchSafeInputImageBlob(input.inputImageUrl!);
}

function buildHeaders(model: LlmModel): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${model.apiKey}`,
  };
  const organization = model.options?.organization;
  if (typeof organization === 'string' && organization) {
    headers['OpenAI-Organization'] = organization;
  }
  return headers;
}

export const openaiImagesProvider: ImageProvider = {
  id: 'openai-images',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const size = aspectRatioToSize(input.aspectRatio);
    const hasInput = !!(input.inputImageUrl || input.inputImageBase64);

    const headers = buildHeaders(model);
    let res: Response;

    if (hasInput) {
      const form = new FormData();
      form.append('image', await fetchInputImageBlob(input), 'image.png');
      form.append('prompt', input.prompt);
      form.append('size', size);
      form.append('n', '1');
      form.append('response_format', 'b64_json');
      form.append('model', model.modelId);
      res = await fetchWithRetry(`${baseUrl}/images/edits`, {
        method: 'POST',
        headers,
        body: form,
      });
    } else {
      res = await fetchWithRetry(`${baseUrl}/images/generations`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.modelId,
          prompt: input.prompt,
          size,
          n: 1,
          response_format: 'b64_json',
        }),
      });
    }

    const json = (await res.json()) as OpenAIImageResponse;
    const first = json.data?.[0];
    if (!first?.b64_json) {
      throw new Error('OpenAI Images response missing data[0].b64_json');
    }
    return [{ type: 'base64', data: first.b64_json, mimeType: 'image/png' }];
  },
};
