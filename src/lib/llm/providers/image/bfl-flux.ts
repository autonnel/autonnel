import { fetchWithRetry } from '../../http';
import { pollPrediction } from '../../poll-prediction';
import type { ImageInput, ImageOutput, ImageProvider } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBytes } from '@/lib/llm/safe-input-media';

const SUPPORTED = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', '9:21']);

interface BflSubmitResponse {
  id: string;
  polling_url?: string;
}
interface BflPollResponse {
  status: string;
  result?: { sample?: string };
  message?: string;
}

async function urlToBase64(url: string): Promise<string> {
  const { buffer } = await fetchInputImageBytes(url);
  return Buffer.from(buffer).toString('base64');
}

export const bflFluxProvider: ImageProvider = {
  id: 'bfl-flux',
  async generateImage(input: ImageInput, model: LlmModel): Promise<ImageOutput[]> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const aspectRatio = SUPPORTED.has(input.aspectRatio ?? '') ? input.aspectRatio : '1:1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-key': model.apiKey,
    };

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
    };
    if (input.inputImageBase64) {
      body.image_prompt = input.inputImageBase64;
    } else if (input.inputImageUrl) {
      body.image_prompt = await urlToBase64(input.inputImageUrl);
    }

    const submitRes = await fetchWithRetry(`${baseUrl}/v1/${model.modelId}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const submitJson = (await submitRes.json()) as BflSubmitResponse;
    const pollUrl = submitJson.polling_url ?? `${baseUrl}/v1/get_result?id=${submitJson.id}`;

    const final = await pollPrediction<BflPollResponse>(
      async () => {
        const res = await fetchWithRetry(pollUrl, { headers: { 'x-key': model.apiKey } });
        return (await res.clone().json()) as BflPollResponse;
      },
      (raw) => {
        if (raw.status === 'Ready') return 'done';
        if (raw.status === 'Pending') return 'pending';
        return 'failed';
      },
      {
        intervalMs: typeof model.options?.pollIntervalMs === 'number' ? model.options.pollIntervalMs as number : 2000,
        timeoutMs: typeof model.options?.pollTimeoutMs === 'number' ? model.options.pollTimeoutMs as number : 300_000,
      },
    );

    const sample = final.result?.sample;
    if (!sample) throw new Error('BFL response missing result.sample');
    return [{ type: 'url', url: sample }];
  },
};
