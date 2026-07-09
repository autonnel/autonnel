import { readEnv } from '@/lib/runtime/env';

const DEV_FALLBACK = 'dev-insecure-secret';

// The dev fallback is publicly known, so it may only be used in an explicit
// development/test run. Any other NODE_ENV — including unset — must fail fast:
// a self-hosted server started without NODE_ENV=production would otherwise
// silently sign forgeable session/checkout cookies with the public fallback.
function devFallbackAllowed(): boolean {
  const nodeEnv = readEnv('NODE_ENV');
  return nodeEnv === 'development' || nodeEnv === 'test';
}

export function resolveSessionSecret(
  envKey = 'AUTH_SESSION_SECRET',
  env?: Record<string, unknown>,
): string {
  const configured = env ? (env[envKey] as string | undefined) : readEnv(envKey);
  if (configured) return configured;

  if (!devFallbackAllowed()) {
    throw new Error(`${envKey} is required unless NODE_ENV is 'development' or 'test'`);
  }

  return DEV_FALLBACK;
}
