import { fetchWithRetry } from '../../http';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

interface ReplicatePrediction {
  id: string;
  status?: string;
  urls?: { get?: string };
  output?: unknown;
  error?: unknown;
}

function mapStatus(s: string | undefined): VideoStatus {
  switch (s) {
    case 'starting':
    case 'processing': return 'processing';
    case 'succeeded': return 'succeeded';
    case 'failed': return 'failed';
    case 'canceled':
    case 'canceling':
    case 'cancelled': return 'cancelled';
    default: return 'queued';
  }
}

function extractOutputUrl(output: unknown): string | undefined {
  if (typeof output === 'string' && output.startsWith('http')) return output;
  if (Array.isArray(output) && typeof output[0] === 'string' && output[0].startsWith('http')) {
    return output[0];
  }
  return undefined;
}

export const replicateVideoProvider: VideoProvider = {
  id: 'replicate-video',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const colonIdx = model.modelId.lastIndexOf(':');
    if (colonIdx < 0) throw new Error('Replicate modelId must include :version-hash');
    const version = model.modelId.slice(colonIdx + 1);

    const inputObj: Record<string, unknown> = { prompt: input.prompt };
    if (input.aspectRatio) inputObj.aspect_ratio = input.aspectRatio;
    if (input.duration !== undefined) inputObj.duration = input.duration;
    if (input.image) inputObj.image = input.image;

    const res = await fetchWithRetry(`${baseUrl}/v1/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${model.apiKey}`,
      },
      body: JSON.stringify({ version, input: inputObj }),
    });
    const json = (await res.json()) as ReplicatePrediction;
    return { id: json.id, raw: json };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1/predictions/${id}`;
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Token ${model.apiKey}` },
    });
    const json = (await res.json()) as ReplicatePrediction;
    const status = mapStatus(json.status);

    if (status === 'succeeded') {
      const outputUrl = extractOutputUrl(json.output);
      if (!outputUrl) throw new Error('Replicate video output shape unsupported');
      return { id, status, outputUrl, raw: json };
    }
    return {
      id,
      status,
      error: status === 'failed' ? (typeof json.error === 'string' ? json.error : JSON.stringify(json.error)) : undefined,
      raw: json,
    };
  },
};
