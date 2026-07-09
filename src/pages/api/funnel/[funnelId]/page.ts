import type { APIRoute } from 'astro';
import { requireFeature } from '@/modules/identity/published/principal';
import { makeAuthoring } from '@/composition/make-authoring';
import { authoringDepsFromLocals } from '@/composition/authoring-runtime';
import { createLogger } from '@/lib/logger';

const logger = createLogger('FunnelStepRoute');

export const POST: APIRoute = async ({ request, params, locals }) => {
  await requireFeature('FUNNELS');
  let body: { stepSlug?: string; pageId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.stepSlug || !body.pageId) {
    return new Response(JSON.stringify({ error: 'stepSlug and pageId are required' }), { status: 400 });
  }
  try {
    const authoring = makeAuthoring(authoringDepsFromLocals(locals));
    await authoring.funnelComposing.addStep({
      funnelId: params.funnelId!,
      stepSlug: body.stepSlug,
      pageId: body.pageId,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    logger.error('Add funnel step failed', { error, funnelId: params.funnelId });
    return new Response(JSON.stringify({ error: 'Add funnel step failed', detail: (error as Error).message }), { status: 422 });
  }
};

// funnelPageId is the step's referenced pageId (the funnel-pages view keys each step by it),
// which stays valid even when the underlying page has been deleted (orphaned step).
export const DELETE: APIRoute = async ({ request, params, locals }) => {
  await requireFeature('FUNNELS');
  let body: { funnelPageId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.funnelPageId) {
    return new Response(JSON.stringify({ error: 'funnelPageId is required' }), { status: 400 });
  }
  try {
    const authoring = makeAuthoring(authoringDepsFromLocals(locals));
    await authoring.funnelComposing.removeStep({ funnelId: params.funnelId!, pageId: body.funnelPageId });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    logger.error('Remove funnel step failed', { error, funnelId: params.funnelId });
    return new Response(JSON.stringify({ error: 'Remove funnel step failed', detail: (error as Error).message }), { status: 422 });
  }
};

export const PUT: APIRoute = async ({ request, params, locals }) => {
  await requireFeature('FUNNELS');
  let body: { funnelPageId?: string; pageId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.funnelPageId || !body.pageId) {
    return new Response(JSON.stringify({ error: 'funnelPageId and pageId are required' }), { status: 400 });
  }
  try {
    const authoring = makeAuthoring(authoringDepsFromLocals(locals));
    await authoring.funnelComposing.replaceStep({
      funnelId: params.funnelId!,
      fromPageId: body.funnelPageId,
      toPageId: body.pageId,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    logger.error('Replace funnel step failed', { error, funnelId: params.funnelId });
    return new Response(JSON.stringify({ error: 'Replace funnel step failed', detail: (error as Error).message }), { status: 422 });
  }
};

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  await requireFeature('FUNNELS');
  let body: { funnelPageId?: string; stepSlug?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
  }
  if (!body.funnelPageId || !body.stepSlug) {
    return new Response(JSON.stringify({ error: 'funnelPageId and stepSlug are required' }), { status: 400 });
  }
  try {
    const authoring = makeAuthoring(authoringDepsFromLocals(locals));
    await authoring.funnelComposing.setStepSlug({
      funnelId: params.funnelId!,
      pageId: body.funnelPageId,
      stepSlug: body.stepSlug,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    logger.error('Update funnel step slug failed', { error, funnelId: params.funnelId });
    return new Response(JSON.stringify({ error: 'Update funnel step slug failed', detail: (error as Error).message }), { status: 422 });
  }
};
