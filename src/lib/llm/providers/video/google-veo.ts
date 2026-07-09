import { fetchWithRetry } from '../../http';
import type { VideoInput, VideoJob, VideoProvider, VideoStatus } from '../../types';
import type { LlmModel } from '@/lib/config/llm-models-types';
import { fetchInputImageBytes } from '@/lib/llm/safe-input-media';

const SUPPORTED = new Set(['16:9', '9:16']);

interface GeneratedVideo {
  video?: { uri?: string; bytesBase64Encoded?: string; mimeType?: string };
}
interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: { generatedSamples?: GeneratedVideo[] };
    generatedVideos?: GeneratedVideo[];
  };
}

async function imageToInstance(image: string): Promise<{ bytesBase64Encoded: string; mimeType: string }> {
  const m = image.match(/^data:(image\/[a-z+\-.]+);base64,(.+)$/i);
  if (m) return { mimeType: m[1], bytesBase64Encoded: m[2] };
  const { buffer, mimeType } = await fetchInputImageBytes(image);
  return { mimeType, bytesBase64Encoded: Buffer.from(buffer).toString('base64') };
}

function pickSample(op: VeoOperation): GeneratedVideo | undefined {
  return (
    op.response?.generateVideoResponse?.generatedSamples?.[0] ??
    op.response?.generatedVideos?.[0]
  );
}

function mapStatus(op: VeoOperation): VideoStatus {
  if (!op.done) return 'processing';
  if (op.error) return 'failed';
  return 'succeeded';
}

export const googleVeoProvider: VideoProvider = {
  id: 'google-veo',
  async createJob(input: VideoInput, model: LlmModel) {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/v1beta/models/${model.modelId}:predictLongRunning?key=${encodeURIComponent(model.apiKey)}`;
    const aspectRatio = SUPPORTED.has(input.aspectRatio ?? '') ? input.aspectRatio : '16:9';

    const instance: Record<string, unknown> = { prompt: input.prompt };
    if (input.image) {
      instance.image = await imageToInstance(input.image);
    }

    const parameters: Record<string, unknown> = {
      aspectRatio,
      sampleCount: 1,
      personGeneration: 'allow_adult',
    };
    if (input.duration !== undefined) parameters.durationSeconds = input.duration;

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [instance], parameters }),
    });
    const json = (await res.json()) as VeoOperation;
    return { id: json.name, raw: json };
  },

  async getJob(id: string, model: LlmModel): Promise<VideoJob> {
    const baseUrl = model.baseUrl.replace(/\/+$/, '');
    const opPath = id.startsWith('operations/') ? id : `operations/${id}`;
    const url = `${baseUrl}/v1beta/${opPath}?key=${encodeURIComponent(model.apiKey)}`;
    const res = await fetchWithRetry(url, {});
    const op = (await res.json()) as VeoOperation;
    const status = mapStatus(op);

    if (status === 'succeeded') {
      const sample = pickSample(op);
      const video = sample?.video;
      if (video?.bytesBase64Encoded) {
        return {
          id,
          status,
          outputBytes: { data: video.bytesBase64Encoded, mimeType: video.mimeType ?? 'video/mp4' },
          raw: op,
        };
      }
      return { id, status, outputUrl: video?.uri, raw: op };
    }

    return {
      id,
      status,
      error: status === 'failed' ? op.error?.message : undefined,
      raw: op,
    };
  },
};
