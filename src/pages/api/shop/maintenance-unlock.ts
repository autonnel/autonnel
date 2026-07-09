import type { APIRoute } from 'astro';
import { verifyPassword } from '@/lib/auth/password';
import { getMaintenanceConfig } from '@/lib/config/keys';
import { createLogger } from '@/lib/logger';
import { createMaintenanceUnlockToken } from '@/lib/auth/maintenance-unlock-token';

const logger = createLogger('MaintenanceUnlock');

const COOKIE_NAME = 'maintenance_pass';
const COOKIE_MAX_AGE = 60 * 60 * 24;
const MAINTENANCE_PAGE = '/_errors/maintenance';

function maintenanceRedirect(error?: string): Response {
  const location = error ? `${MAINTENANCE_PAGE}?error=${encodeURIComponent(error)}` : MAINTENANCE_PAGE;
  return new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

export const POST: APIRoute = async ({ request, url, redirect }) => {
  let password = '';
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      password = String(form.get('password') ?? '');
    } else {
      const body = (await request.json().catch(() => null)) as { password?: string } | null;
      password = body?.password ?? '';
    }
  } catch (err) {
    logger.warn('Failed to parse unlock body', { error: err });
  }

  const cfg = await getMaintenanceConfig();

  if (!cfg?.enabled) {
    return redirect('/', 303);
  }

  const hash = cfg.passwordHash;
  if (!hash) {
    return maintenanceRedirect();
  }

  const ok = password.length > 0 && (await verifyPassword(password, hash));
  if (!ok) {
    return maintenanceRedirect('Incorrect password.');
  }

  const isHttps = url.protocol === 'https:';
  const unlockToken = await createMaintenanceUnlockToken(hash);
  const cookieParts = [
    `${COOKIE_NAME}=${encodeURIComponent(unlockToken)}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isHttps) cookieParts.push('Secure');

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': cookieParts.join('; '),
      'Cache-Control': 'no-store',
    },
  });
};
