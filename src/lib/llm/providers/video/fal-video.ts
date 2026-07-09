import { fetchWithRetry } from '../../http';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';

interface FalSubmit {
  request_id: string;
  status_url?: string;
  response_url?: string;
}
interface FalStatus {
  status: string;
  error?: unknown;
}
interface FalResult {
  video?: { url?: string };
  videos?: Array<{ url?: string }>;
}

function mapStatus(s: string | undefined): VideoStatus {
  switch (s) {
    case 'IN_QUEUE': return 'queued';
    case 'IN_PROGRESS': return 'processing';
    case 'COMPLETED': return 'succeeded';
    case 'FAILED': return 'failed';
    default: return 'processing';
  }
}

function encodeId(request_id: string, status_url: string, response_url: string): string {
  return `${request_id}|${status_url}|${response_url}`;
}

function decodeId(id: string): { request_id: string; status_url: string; response_url: string } {
  const parts = id.split('|');
  if (parts.length !== 3) throw new Error('fal-video: malformed job id');
  return { request_id: parts[0], status_url: parts[1], response_url: parts[2] };
}

export const falVideoProvider: VideoProvider = {
  id: 'fal-video',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const body: Record<string, unknown> = { prompt: input.prompt };
    if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
    if (input.duration !== undefined) body.duration = input.duration;
    if (input.image) body.image_url = input.image;

    const res = await fetchWithRetry(`${baseUrl}/${model.modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${model.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const submit = (await res.json()) as FalSubmit;
    const statusUrl = submit.status_url ?? `${baseUrl}/${model.modelId}/requests/${submit.request_id}/status`;
    const responseUrl = submit.response_url ?? `${baseUrl}/${model.modelId}/requests/${submit.request_id}`;
    return { id: encodeId(submit.request_id, statusUrl, responseUrl), raw: submit };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const { request_id, status_url, response_url } = decodeId(id);
    const headers = { Authorization: `Key ${model.apiKey}` };

    const statusRes = await fetchWithRetry(status_url, { headers });
    const statusJson = (await statusRes.json()) as FalStatus;
    const status = mapStatus(statusJson.status);

    if (status === 'succeeded') {
      const resultRes = await fetchWithRetry(response_url, { headers });
      const result = (await resultRes.json()) as FalResult;
      const outputUrl = result.video?.url ?? result.videos?.[0]?.url;
      if (!outputUrl) throw new Error('fal video response missing video URL');
      return { id, status, outputUrl, raw: { request_id, status: statusJson, result } };
    }
    return {
      id,
      status,
      error: status === 'failed' ? (typeof statusJson.error === 'string' ? statusJson.error : JSON.stringify(statusJson.error)) : undefined,
      raw: { request_id, status: statusJson },
    };
  },
};
