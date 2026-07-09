import { fetchWithRetry } from '../../http';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBytes } from '@/lib/llm/safe-input-media';

const SUPPORTED = new Set(['1:1', '16:9', '9:16', '4:3', '3:4']);

interface InlineDataPart {
  inlineData?: { mimeType?: string; data?: string };
  text?: string;
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: InlineDataPart[] } }>;
}

async function urlToInlineData(url: string): Promise<{ mimeType: string; data: string }> {
  const { buffer, mimeType } = await fetchInputImageBytes(url);
  const data = Buffer.from(buffer).toString('base64');
  return { mimeType, data };
}

export const geminiImageProvider: ImageProvider = {
  id: 'gemini-image',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1beta/models/${model.modelId}:generateContent?key=${encodeURIComponent(model.apiKey)}`;

    const parts: InlineDataPart[] = [{ text: input.prompt }];
    if (input.inputImageUrl) {
      parts.push({ inlineData: await urlToInlineData(input.inputImageUrl) });
    } else if (input.inputImageBase64) {
      parts.push({
        inlineData: {
          mimeType: input.inputImageMimeType ?? 'image/png',
          data: input.inputImageBase64,
        },
      });
    }

    const aspectRatio = SUPPORTED.has(input.aspectRatio ?? '') ? input.aspectRatio : '1:1';

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { aspectRatio, responseModalities: ['IMAGE'] },
      }),
    });

    const json = (await res.json()) as GeminiResponse;
    for (const candidate of json.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        const inline = part.inlineData;
        if (inline?.data && inline.mimeType) {
          return [{
            type: 'base64',
            data: inline.data,
            mimeType: inline.mimeType as ImageOutput extends { type: 'base64'; mimeType: infer M } ? M : never,
          }];
        }
      }
    }
    throw new Error('Gemini response missing inlineData image part');
  },
};
