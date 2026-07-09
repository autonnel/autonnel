import type { APIRoute } from 'astro';
import { withCronAuth, jsonResponse } from '@/lib/api-helpers';
import { runConversionAnalysisSweep } from '@/composition/analytics/run-conversion-analysis';

export const POST: APIRoute = withCronAuth(async () => {
  const result = await runConversionAnalysisSweep({ force: true });
  return jsonResponse(result);
});

export const GET: APIRoute = withCronAuth(async (context) => POST(context));
