import { fetchWithRetry } from '../../http';
import { ensureImageUrl } from '../../video-output';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const DEFAULT_RUNWAY_VERSION = '2024-11-06';

interface RunwayTask {
  id: string;
  status?: string;
  output?: string[];
  failure?: string;
  failureCode?: string;
}

function aspectRatioToRatio(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case '9:16': return '720:1280';
    case '1:1': return '960:960';
    case '16:9': return '1280:720';
    default: return '1280:720';
  }
}

function mapStatus(s: string | undefined): VideoStatus {
  switch (s) {
    case 'PENDING': return 'queued';
    case 'RUNNING':
    case 'THROTTLED': return 'processing';
    case 'SUCCEEDED': return 'succeeded';
    case 'FAILED': return 'failed';
    case 'CANCELED':
    case 'CANCELLED': return 'cancelled';
    default: return 'processing';
  }
}

function clampDuration(d: number | undefined): number {
  if (d === 10) return 10;
  return 5;
}

function buildHeaders(model: LlmModel): Record<string, string> {
  const version = typeof model.options?.runwayVersion === 'string'
    ? (model.options.runwayVersion as string)
    : DEFAULT_RUNWAY_VERSION;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${model.apiKey}`,
    'X-Runway-Version': version,
  };
}

export const runwayVideoProvider: VideoProvider = {
  id: 'runway-video',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const ratio = aspectRatioToRatio(input.aspectRatio);
    const duration = clampDuration(input.duration);

    if (input.image) {
      const promptImage = await ensureImageUrl(input.image, undefined);
      const res = await fetchWithRetry(`${baseUrl}/v1/image_to_video`, {
        method: 'POST',
        headers: buildHeaders(model),
        body: JSON.stringify({
          model: model.modelId,
          promptImage,
          promptText: input.prompt,
          ratio,
          duration,
        }),
      });
      const json = (await res.json()) as RunwayTask;
      return { id: json.id, raw: json };
    }

    const res = await fetchWithRetry(`${baseUrl}/v1/text_to_video`, {
      method: 'POST',
      headers: buildHeaders(model),
      body: JSON.stringify({
        model: model.modelId,
        promptText: input.prompt,
        ratio,
        duration,
      }),
    });
    const json = (await res.json()) as RunwayTask;
    return { id: json.id, raw: json };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const res = await fetchWithRetry(`${baseUrl}/v1/tasks/${id}`, {
      headers: buildHeaders(model),
    });
    const json = (await res.json()) as RunwayTask;
    const status = mapStatus(json.status);
    return {
      id,
      status,
      outputUrl: status === 'succeeded' ? json.output?.[0] : undefined,
      error: status === 'failed' ? (json.failure ?? json.failureCode) : undefined,
      raw: json,
    };
  },
};
