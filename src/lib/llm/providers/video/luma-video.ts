import { fetchWithRetry } from '../../http';
import { ensureImageUrl } from '../../video-output';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

const SUPPORTED = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21']);

interface LumaGeneration {
  id: string;
  state?: string;
  assets?: { video?: string };
  failure_reason?: string;
}

function mapStatus(state: string | undefined): VideoStatus {
  switch (state) {
    case 'queued': return 'queued';
    case 'dreaming':
    case 'pending':
    case 'processing': return 'processing';
    case 'completed': return 'succeeded';
    case 'failed': return 'failed';
    default: return 'processing';
  }
}

export const lumaVideoProvider: VideoProvider = {
  id: 'luma-video',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const aspectRatio = SUPPORTED.has(input.aspectRatio ?? '') ? input.aspectRatio : '16:9';

    const body: Record<string, unknown> = {
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
      model: model.modelId,
    };
    if (input.duration !== undefined) {
      body.duration = `${input.duration}s`;
    }
    if (input.image) {
      const url = await ensureImageUrl(input.image, undefined);
      body.keyframes = { frame0: { type: 'image', url } };
    }

    const res = await fetchWithRetry(`${baseUrl}/dream-machine/v1/generations/video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as LumaGeneration;
    return { id: json.id, raw: json };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const res = await fetchWithRetry(`${baseUrl}/dream-machine/v1/generations/${id}`, {
      headers: { Authorization: `Bearer ${model.apiKey}` },
    });
    const json = (await res.json()) as LumaGeneration;
    const status = mapStatus(json.state);
    return {
      id,
      status,
      outputUrl: status === 'succeeded' ? json.assets?.video : undefined,
      error: status === 'failed' ? json.failure_reason : undefined,
      raw: json,
    };
  },
};
