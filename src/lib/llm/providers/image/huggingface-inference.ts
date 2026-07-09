import { fetchWithRetry } from '../../http';
import { createLogger } from '@/lib/logger';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const logger = createLogger('LlmImage:huggingface-inference');

const DIMS: Record<string, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1152, height: 896 },
  '3:4': { width: 896, height: 1152 },
};

function normalizeMime(contentType: string): 'image/png' | 'image/jpeg' | 'image/webp' {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg';
  if (contentType.includes('webp')) return 'image/webp';
  return 'image/png';
}

export const huggingfaceInferenceProvider: ImageProvider = {
  id: 'huggingface-inference',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    if (input.inputImageUrl || input.inputImageBase64) {
      logger.warn('huggingface-inference does not support image-to-image in Phase B; ignoring input image');
    }
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const dims = DIMS[input.aspectRatio ?? '1:1'] ?? DIMS['1:1'];

    const res = await fetchWithRetry(`${baseUrl}/models/${model.modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({ inputs: input.prompt, parameters: dims }),
    });

    const ct = res.headers.get('content-type') ?? 'image/png';
    const buf = await res.arrayBuffer();
    const data = Buffer.from(buf).toString('base64');
    return [{ type: 'base64', data, mimeType: normalizeMime(ct) }];
  },
};
