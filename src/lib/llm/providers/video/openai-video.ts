import { fetchWithRetry } from '../../http';
import { ProviderHttpError } from '../../errors';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBlob } from '@/lib/llm/safe-input-media';

interface SoraResponse {
  id: string;
  status?: string;
  error?: { message?: string };
}

function aspectRatioToSize(aspectRatio: string | undefined): string {
  switch (aspectRatio) {
    case '9:16': return '720x1280';
    case '1:1': return '1024x1024';
    case '16:9': return '1280x720';
    default: return '1280x720';
  }
}

function mapStatus(s: string | undefined): VideoStatus {
  switch (s) {
    case 'queued': return 'queued';
    case 'in_progress':
    case 'processing': return 'processing';
    case 'completed': return 'succeeded';
    case 'failed': return 'failed';
    case 'cancelled':
    case 'canceled': return 'cancelled';
    default: return 'processing';
  }
}

function buildHeaders(model: LlmModel): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${model.apiKey}` };
  const org = model.options?.organization;
  if (typeof org === 'string' && org) headers['OpenAI-Organization'] = org;
  return headers;
}

async function fetchInputBlob(image: string): Promise<Blob> {
  const dataMatch = image.match(/^data:(image\/[a-z+\-.]+);base64,(.+)$/i);
  if (dataMatch) {
    return new Blob([Buffer.from(dataMatch[2], 'base64')], { type: dataMatch[1] });
  }
  return fetchInputImageBlob(image);
}

export const openaiVideoProvider: VideoProvider = {
  id: 'openai-video',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const size = aspectRatioToSize(input.aspectRatio);
    const headers = buildHeaders(model);
    let res: Response;

    if (input.image) {
      const form = new FormData();
      form.append('model', model.modelId);
      form.append('prompt', input.prompt);
      form.append('size', size);
      if (input.duration !== undefined) form.append('seconds', String(input.duration));
      form.append('input_reference', await fetchInputBlob(input.image), 'image.png');
      res = await fetchWithRetry(`${baseUrl}/v1/videos`, {
        method: 'POST',
        headers,
        body: form,
      });
    } else {
      const body: Record<string, unknown> = {
        model: model.modelId,
        prompt: input.prompt,
        size,
      };
      if (input.duration !== undefined) body.seconds = input.duration;
      res = await fetchWithRetry(`${baseUrl}/v1/videos`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    const json = (await res.json()) as SoraResponse;
    return { id: json.id, raw: json };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const headers = buildHeaders(model);
    const res = await fetchWithRetry(`${baseUrl}/v1/videos/${id}`, { headers });
    const json = (await res.json()) as SoraResponse;
    const status = mapStatus(json.status);

    if (status === 'succeeded') {
      const contentRes = await fetchWithRetry(`${baseUrl}/v1/videos/${id}/content`, { headers });
      if (!contentRes.ok) {
        throw new ProviderHttpError(contentRes.status, '');
      }
      const ct = contentRes.headers.get('content-type') ?? 'video/mp4';
      const buf = await contentRes.arrayBuffer();
      const data = Buffer.from(buf).toString('base64');
      return {
        id,
        status,
        outputBytes: { data, mimeType: ct },
        raw: json,
      };
    }

    return {
      id,
      status,
      error: json.error?.message,
      raw: json,
    };
  },
};
