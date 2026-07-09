// AI media (image/video) generation on the unified @/lib/llm provider stack + the generic Job table.
// Image generation is synchronous (the provider call uploads to S3 and returns the final CDN URL);
// video is async — the first run creates the provider job and defers, then the generic `jobs.poll`
// cron re-polls until the external job reaches a terminal state. The first attempt runs inside the
// POST request scope (await runById), so its DB writes never race the per-request pool disposal.
import { callImage, getVideoProvider, LlmNotConfiguredError } from '@/lib/llm';
import { normalizeVideoToS3Url } from '@/lib/llm/video-output';
import { getLlmModel } from '@/lib/config/llm-models';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { runWithRequestDb, disposeRequestDb } from '@/lib/db';
import { runWithTenant, getCurrentTenantId } from '@/lib/tenant/context';
import { deferJob, JobDeferral } from '@/modules/platform/application/ports';
import { registerJobHandler, makePlatform } from './make-platform';

interface CfLocals { cfContext?: { waitUntil(p: Promise<unknown>): void } }

export type MediaKind = 'image' | 'video';

export interface MediaGenerationInput {
  type: MediaKind;
  prompt: string;
  aspectRatio?: string;
  inputImage?: string;
  modelName?: string;
  duration?: number;
}

interface ImagePayload { prompt: string; aspectRatio?: string; inputImage?: string; modelName?: string }
interface VideoPayload { prompt: string; aspectRatio?: string; inputImage?: string; modelName?: string; duration?: number }

// Video re-poll spacing. The generic jobs.poll cron only fires every 5 min, so this is a floor.
const VIDEO_POLL_INTERVAL_MS = 5_000;

export async function runImageGeneration(payload: unknown): Promise<{ url: string }> {
  const p = payload as ImagePayload;
  const url = await callImage({
    prompt: p.prompt,
    aspectRatio: p.aspectRatio,
    inputImageUrl: p.inputImage,
    modelName: p.modelName,
  });
  return { url };
}

export async function runVideoGeneration(
  payload: unknown,
  ctx: { externalRef: string | null },
): Promise<{ url: string } | JobDeferral> {
  const p = payload as VideoPayload;
  const row = (p.modelName ? await getLlmModel('video', p.modelName) : undefined) ?? (await getLlmModel('video'));
  if (!row) throw new LlmNotConfiguredError();
  const provider = getVideoProvider(row.provider);

  if (!ctx.externalRef) {
    const { id } = await provider.createJob(
      { prompt: p.prompt, aspectRatio: p.aspectRatio, image: p.inputImage, duration: p.duration },
      row,
    );
    return deferJob({ externalRef: id, runAfter: new Date(Date.now() + VIDEO_POLL_INTERVAL_MS) });
  }

  const job = await provider.getJob(ctx.externalRef, row);
  if (job.status === 'succeeded') return { url: await normalizeVideoToS3Url(job, undefined) };
  if (job.status === 'failed' || job.status === 'cancelled') {
    throw new Error(job.error ?? `video generation ${job.status}`);
  }
  return deferJob({ externalRef: ctx.externalRef, runAfter: new Date(Date.now() + VIDEO_POLL_INTERVAL_MS) });
}

export function registerMediaGenerationHandlers(): void {
  registerJobHandler('media.image', (payload) => runImageGeneration(payload));
  registerJobHandler('media.video', (payload, ctx) => runVideoGeneration(payload, ctx));
}

export async function isMediaModelConfigured(type: MediaKind, modelName?: string): Promise<boolean> {
  const model = (modelName ? await getLlmModel(type, modelName) : undefined) ?? (await getLlmModel(type));
  return !!model;
}

export async function enqueueMediaGeneration(locals: unknown, input: MediaGenerationInput): Promise<{ id: string }> {
  registerMediaGenerationHandlers();
  const tenantId = getCurrentTenantId();
  const { enqueueJob } = makePlatform((locals ?? {}) as CfLocals);
  const { jobId } = await enqueueJob.enqueue({
    kind: input.type === 'video' ? 'media.video' : 'media.image',
    payload: {
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      inputImage: input.inputImage,
      modelName: input.modelName,
      duration: input.duration,
    },
    dispatch: 'CRON_POLL', // first attempt runs in the background below; video re-polls drain via the jobs.poll cron
    maxAttempts: input.type === 'video' ? 5 : 3,
  });

  // Run the first attempt in the background on its OWN request-db scope, so the long provider call
  // (and the getConfig/storage reads inside it) never touch the POST request's pool — which is
  // disposed the moment we return {id}. On Workers this also dodges the ~100s response limit: the
  // POST returns immediately and the frontend polls GET until the job reaches a terminal state.
  // For images the whole generation happens here; for video only createJob+defer (then jobs.poll cron).
  const firstRun = runWithRequestDb(async () => {
    try {
      await runWithTenant(tenantId, async () => {
        const { runJob } = makePlatform({});
        await runJob.runById(jobId);
      });
    } finally {
      await disposeRequestDb();
    }
  });
  const waitUntil = (locals as CfLocals)?.cfContext?.waitUntil;
  if (waitUntil) waitUntil.call((locals as CfLocals).cfContext, firstRun);
  else void firstRun; // Node dev: fire-and-forget (its own scope, disposed in the finally above)

  return { id: jobId };
}

export interface MediaJobView {
  status: 'PROCESSING' | 'COMPLETED' | 'ERROR';
  url?: string;
  error?: string;
}

export async function readMediaJob(id: string): Promise<MediaJobView | null> {
  const db = getTenantPrisma() as unknown as {
    job: {
      findUnique(args: { where: { id: string }; select: Record<string, boolean> }):
        Promise<{ status: string; result: unknown; failureReason: string | null } | null>;
    };
  };
  const row = await db.job.findUnique({ where: { id }, select: { status: true, result: true, failureReason: true } });
  if (!row) return null;
  if (row.status === 'SUCCEEDED') return { status: 'COMPLETED', url: (row.result as { url?: string } | null)?.url };
  if (row.status === 'FAILED' || row.status === 'CANCELLED') return { status: 'ERROR', error: row.failureReason ?? undefined };
  return { status: 'PROCESSING' };
}
