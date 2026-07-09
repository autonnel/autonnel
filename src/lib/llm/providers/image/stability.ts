import { fetchWithRetry } from '../../http';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBytes } from '@/lib/llm/safe-input-media';

const SUPPORTED = new Set(['21:9', '16:9', '3:2', '5:4', '1:1', '4:5', '2:3', '9:16', '9:21']);

interface StabilityResponse {
  image?: string;
}

function inferEndpoint(modelId: string): string {
  if (modelId.startsWith('sd3')) return 'sd3';
  if (modelId.includes('core')) return 'core';
  if (modelId.includes('ultra')) return 'ultra';
  return 'sd3';
}

export const stabilityProvider: ImageProvider = {
  id: 'stability',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const endpoint = (typeof model.options?.endpoint === 'string' ? model.options.endpoint : null) ?? inferEndpoint(model.modelId);
    const aspectRatio = SUPPORTED.has(input.aspectRatio ?? '') ? input.aspectRatio! : '1:1';
    const hasInput = !!(input.inputImageUrl || input.inputImageBase64);

    const form = new FormData();
    form.append('prompt', input.prompt);
    form.append('aspect_ratio', aspectRatio);
    form.append('mode', hasInput ? 'image-to-image' : 'text-to-image');

    if (input.inputImageBase64) {
      const buf = Buffer.from(input.inputImageBase64, 'base64');
      form.append('image', new Blob([buf], { type: input.inputImageMimeType ?? 'image/png' }), 'image.png');
      form.append('strength', '0.6');
    } else if (input.inputImageUrl) {
      const { buffer, mimeType } = await fetchInputImageBytes(input.inputImageUrl);
      form.append('image', new Blob([buffer], { type: mimeType }), 'image.png');
      form.append('strength', '0.6');
    }

    const res = await fetchWithRetry(`${baseUrl}/v2beta/stable-image/generate/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${model.apiKey}`,
        Accept: 'application/json',
      },
      body: form,
    });

    const json = (await res.json()) as StabilityResponse;
    if (!json.image) throw new Error('Stability response missing image');
    return [{ type: 'base64', data: json.image, mimeType: 'image/png' }];
  },
};
