import { randomBytes } from 'node:crypto';
import { makeIdentity } from '@/composition/make-identity';
import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { runWithTenant } from '@/lib/tenant/context';
import { DEFAULT_TENANT } from '@/modules/shared-kernel/tenant-id';
import { resolveSessionSecret } from '@/lib/services/session-secret';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const REJECT_THRESHOLD = 248;

export function generatePassword(length = 16): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('Password length must be a positive integer');
  }
  const out: string[] = [];
  while (out.length < length) {
    const need = length - out.length;
    const buf = randomBytes(need * 2);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const b = buf[i];
      if (b >= REJECT_THRESHOLD) continue;
      out.push(CHARSET[b % CHARSET.length]);
    }
  }
  return out.join('');
}

export async function runPasswordReset(args: string[]): Promise<void> {
  const email = args[0];
  if (!email) {
    process.stderr.write('Usage: npx autonnel password:reset <email>\n');
    process.exit(1);
  }
  try {
    const newPassword = generatePassword();
    const result = await runWithTenant(DEFAULT_TENANT, async () => {
      const identity = makeIdentity({
        rawPrisma: getBasePrisma(),
        scopedPrisma: getTenantPrisma(),
        sessionSecret: resolveSessionSecret('AUTH_SESSION_SECRET'),
      });
      return identity.dashboardPasswordReset.reset({ email, newPassword });
    });
    process.stdout.write(`Password reset for ${email} (id=${result.userId})\n`);
    process.stdout.write(`New password: ${newPassword}\n\n`);
    process.stdout.write(
      `All sessions for this user have been revoked (${result.sessionsRevoked}); they must log in again.\n`,
    );
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}
