import { createInterface } from 'node:readline';
import { makeIdentity } from '@/composition/make-identity';
import { getBasePrisma } from '@/lib/db';
import { getTenantPrisma } from '@/modules/platform/infra/prisma-tenant-extension';
import { runWithTenant } from '@/lib/tenant/context';
import { DEFAULT_TENANT } from '@/modules/shared-kernel/tenant-id';
import { resolveSessionSecret } from '@/lib/services/session-secret';

function confirmOverwrite(email: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(`User ${email} already exists. Overwrite its password? [y/N] `, (answer) => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer.trim()));
    });
  });
}

export async function runAdminCreate(args: string[]): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');
  const positional = args.filter((a) => a !== '--force' && a !== '-f');
  const email = positional[0];
  const password = positional[1];
  if (!email || !password) {
    process.stderr.write('Usage: npx autonnel admin:create <email> <password> [--force]\n');
    process.exit(1);
  }
  try {
    const identity = () =>
      makeIdentity({
        rawPrisma: getBasePrisma(),
        scopedPrisma: getTenantPrisma(),
        sessionSecret: resolveSessionSecret('AUTH_SESSION_SECRET'),
      });

    const result = await runWithTenant(DEFAULT_TENANT, async () =>
      identity().adminProvisioning.provisionAdmin({ email, password }),
    );

    if (result.created) {
      process.stdout.write(`Created admin user ${email} (id=${result.userId})\n`);
      return;
    }

    // Existing account: provisionAdmin granted the Admin role but left the password untouched.
    process.stdout.write(`Granted admin to existing user ${email} (id=${result.userId}); password unchanged.\n`);

    if (!force && !process.stdin.isTTY) {
      process.stderr.write(
        'Refusing to overwrite an existing password non-interactively. ' +
          'Re-run with --force, or use `npx autonnel password:reset <email>`.\n',
      );
      process.exit(1);
    }

    const overwrite = force || (await confirmOverwrite(email));
    if (!overwrite) {
      process.stdout.write('Password left unchanged. Use `npx autonnel password:reset` to rotate it.\n');
      return;
    }

    const reset = await runWithTenant(DEFAULT_TENANT, async () =>
      identity().adminPasswordReset.reset({ email, newPassword: password }),
    );
    process.stdout.write(
      `Updated password for ${email} (id=${reset.userId}); revoked ${reset.sessionsRevoked} active session(s).\n`,
    );
  } catch (err) {
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}
