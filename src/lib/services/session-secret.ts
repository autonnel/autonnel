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

// Accepts a key chain so a purpose-specific secret can stay an optional override of
// AUTH_SESSION_SECRET. Requiring an undocumented second secret took checkout down
// silently for weeks: pages still rendered, only the API threw.
export function resolveSessionSecret(
  envKey: string | string[] = 'AUTH_SESSION_SECRET',
  env?: Record<string, unknown>,
): string {
  const envKeys = Array.isArray(envKey) ? envKey : [envKey];
  for (const key of envKeys) {
    const configured = env ? (env[key] as string | undefined) : readEnv(key);
    if (configured) return configured;
  }

  if (!devFallbackAllowed()) {
    throw new Error(`${envKeys.join(' or ')} is required unless NODE_ENV is 'development' or 'test'`);
  }

  return DEV_FALLBACK;
}
