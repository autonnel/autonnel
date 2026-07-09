import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from './errors';
import { pollJob } from './poll';
import { getVideoProvider } from './registry';
import { normalizeVideoToS3Url } from './video-output';

export interface CallVideoOptions {
  modelName?: string;
  prompt: string;
  aspectRatio?: string;
  image?: string;
  duration?: number;
  userId?: string;
}

export async function callVideo(options: CallVideoOptions): Promise<string> {
  const name = options.modelName?.trim();
  const row =
    (name ? await getLlmModel('video', name) : undefined) ??
    (await getLlmModel('video'));
  if (!row) throw new LlmNotConfiguredError();

  const provider = getVideoProvider(row.provider);
  const { id } = await provider.createJob(
    {
      prompt: options.prompt,
      aspectRatio: options.aspectRatio,
      image: options.image,
      duration: options.duration,
    },
    row,
  );

  const intervalMs = typeof row.options?.pollIntervalMs === 'number'
    ? (row.options.pollIntervalMs as number)
    : 3000;
  const timeoutMs = typeof row.options?.pollTimeoutMs === 'number'
    ? (row.options.pollTimeoutMs as number)
    : 600_000;

  const job = await pollJob(provider, id, row, { intervalMs, timeoutMs });

  if (job.status !== 'succeeded') {
    throw new Error(job.error ?? `Video generation ended with status: ${job.status}`);
  }

  return normalizeVideoToS3Url(job, options.userId);
}
