import { fetchWithRetry } from '../../http';
import { pollPrediction } from '../../poll-prediction';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

interface ReplicatePrediction {
  id: string;
  status?: string;
  urls?: { get?: string };
  output?: unknown;
  error?: unknown;
}

export const replicateProvider: ImageProvider = {
  id: 'replicate',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const colonIdx = model.modelId.lastIndexOf(':');
    if (colonIdx < 0) {
      throw new Error('Replicate modelId must include :version-hash');
    }
    const version = model.modelId.slice(colonIdx + 1);

    const inputObj: Record<string, unknown> = { prompt: input.prompt };
    if (input.aspectRatio) inputObj.aspect_ratio = input.aspectRatio;
    if (input.inputImageUrl) {
      inputObj.image = input.inputImageUrl;
    } else if (input.inputImageBase64 && input.inputImageMimeType) {
      inputObj.image = `data:${input.inputImageMimeType};base64,${input.inputImageBase64}`;
    }

    const submitRes = await fetchWithRetry(`${baseUrl}/v1/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${model.apiKey}`,
      },
      body: JSON.stringify({ version, input: inputObj }),
    });
    const submit = (await submitRes.clone().json()) as ReplicatePrediction;
    const pollUrl = submit.urls?.get ?? `${baseUrl}/v1/predictions/${submit.id}`;

    const final = await pollPrediction<ReplicatePrediction>(
      async () => {
        const r = await fetchWithRetry(pollUrl, {
          headers: { Authorization: `Token ${model.apiKey}` },
        });
        return (await r.clone().json()) as ReplicatePrediction;
      },
      (raw) => {
        if (raw.status === 'succeeded') return 'done';
        if (raw.status === 'starting' || raw.status === 'processing') return 'pending';
        return 'failed';
      },
      {
        intervalMs: typeof model.options?.pollIntervalMs === 'number' ? model.options.pollIntervalMs as number : 2000,
        timeoutMs: typeof model.options?.pollTimeoutMs === 'number' ? model.options.pollTimeoutMs as number : 300_000,
      },
    );

    const output = final.output;
    if (typeof output === 'string' && output.startsWith('http')) {
      return [{ type: 'url', url: output }];
    }
    if (Array.isArray(output) && typeof output[0] === 'string' && output[0].startsWith('http')) {
      return [{ type: 'url', url: output[0] }];
    }
    throw new Error('Replicate output shape unsupported');
  },
};
