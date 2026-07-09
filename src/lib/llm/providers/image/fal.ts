import { fetchWithRetry } from '../../http';
import { pollPrediction } from '../../poll-prediction';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const IMAGE_SIZE_MAP: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
};

interface FalSubmitResponse {
  request_id: string;
  status_url?: string;
  response_url?: string;
}
interface FalStatusResponse {
  status: string;
  error?: unknown;
}
interface FalResultResponse {
  images?: Array<{ url?: string }>;
}

export const falProvider: ImageProvider = {
  id: 'fal',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const imageSize = IMAGE_SIZE_MAP[input.aspectRatio ?? '1:1'] ?? 'square_hd';

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      image_size: imageSize,
    };
    const referenceUrl =
      input.inputImageUrl ??
      (input.inputImageBase64 && input.inputImageMimeType
        ? `data:${input.inputImageMimeType};base64,${input.inputImageBase64}`
        : undefined);
    if (referenceUrl) {
      // `image_urls` is the canonical array param; some models use singular `image_url` instead.
      const explicit =
        typeof model.options?.inputImageParam === 'string'
          ? (model.options.inputImageParam as string)
          : null;
      const paramName = explicit === 'image_url' ? 'image_url' : 'image_urls';
      body[paramName] = paramName === 'image_urls' ? [referenceUrl] : referenceUrl;
    }

    const submitRes = await fetchWithRetry(`${baseUrl}/${model.modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${model.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const submit = (await submitRes.json()) as FalSubmitResponse;
    const statusUrl = submit.status_url ?? `${baseUrl}/${model.modelId}/requests/${submit.request_id}/status`;
    const responseUrl = submit.response_url ?? `${baseUrl}/${model.modelId}/requests/${submit.request_id}`;

    await pollPrediction<FalStatusResponse>(
      async () => {
        const r = await fetchWithRetry(statusUrl, {
          headers: { Authorization: `Key ${model.apiKey}` },
        });
        return (await r.clone().json()) as FalStatusResponse;
      },
      (raw) => {
        if (raw.status === 'COMPLETED') return 'done';
        if (raw.status === 'IN_QUEUE' || raw.status === 'IN_PROGRESS') return 'pending';
        return 'failed';
      },
      {
        intervalMs: typeof model.options?.pollIntervalMs === 'number' ? model.options.pollIntervalMs as number : 2000,
        timeoutMs: typeof model.options?.pollTimeoutMs === 'number' ? model.options.pollTimeoutMs as number : 300_000,
      },
    );

    const resultRes = await fetchWithRetry(responseUrl, {
      headers: { Authorization: `Key ${model.apiKey}` },
    });
    const result = (await resultRes.json()) as FalResultResponse;
    const url = result.images?.[0]?.url;
    if (!url) throw new Error('fal response missing images[0].url');
    return [{ type: 'url', url }];
  },
};
