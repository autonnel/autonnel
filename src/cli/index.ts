#!/usr/bin/env node
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PACKAGE_NAME = 'autonnel';
const VALID_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(here, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  process.stdout.write(`autonnel — open-source funnel builder

Usage:
  npx autonnel admin:create <email> <password>      Create (or grant) a full-access admin user
  npx autonnel password:reset <email>               Reset a user's password (auto-generated)
  npx autonnel --help                                Show this message
  npx autonnel --version                             Print version

Scaffolding & marketplace (use create-autonnel — zero dependencies):
  npm create autonnel [project-name]                Scaffold a new Autonnel project
  npx create-autonnel authorize                      Authorize this machine against the marketplace
  npx create-autonnel orders                         List your purchased plugins and template packs
  npx create-autonnel install <item>                 Download and install a purchased pack

Examples:
  npx autonnel admin:create admin@example.com secret123
  npx autonnel password:reset admin@example.com
`);
}

// Locate the consumer project root (the directory the command runs in). The CLI is
// build-time tooling: it never opens the OSS DB, so a package.json is the only sanity
// check we need.
export function resolveConsumerRoot(): string {
  const cwd = process.cwd();
  if (!existsSync(resolve(cwd, 'package.json'))) {
    process.stderr.write(
      'Error: no package.json in the current directory. Run this inside your Autonnel project.\n',
    );
    process.exit(1);
  }
  return cwd;
}

export function validateProjectName(name: string): { ok: true } | { ok: false; reason: string } {
  if (!name) return { ok: false, reason: 'project name is required' };
  if (name.length > 214) return { ok: false, reason: 'project name must be <= 214 characters' };
  if (!VALID_NAME.test(name)) {
    return { ok: false, reason: 'project name must match npm package naming rules (lowercase letters, digits, dashes, dots, underscores, optional @scope/)' };
  }
  return { ok: true };
}


export async function runCli(argv: string[]): Promise<void> {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    printHelp();
    return;
  }
  if (args[0] === '-v' || args[0] === '--version') {
    process.stdout.write(`${PACKAGE_NAME} v${readVersion()}\n`);
    return;
  }
  const command = args[0];
  const rest = args.slice(1);
  switch (command) {
    case 'create': {
      const { runCreate } = await import('./create.js');
      runCreate(rest);
      return;
    }
    case 'admin:create': {
      const { runAdminCreate } = await import('./admin-create.js');
      await runAdminCreate(rest);
      return;
    }
    case 'password:reset': {
      const { runPasswordReset } = await import('./password-reset.js');
      await runPasswordReset(rest);
      return;
    }
    case 'authorize': {
      const { runAuthorize } = await import('./authorize.js');
      await runAuthorize(rest);
      return;
    }
    case 'orders': {
      const { runOrders } = await import('./orders.js');
      await runOrders(rest);
      return;
    }
    case 'install': {
      const { runInstall } = await import('./install.js');
      await runInstall(rest);
      return;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\n\n`);
      printHelp();
      process.exit(1);
  }
}

const isMain = (() => {
  try {
    if (!process.argv[1]) return false;
    const realHere = realpathSync(fileURLToPath(import.meta.url)).toLowerCase();
    const realInvoked = realpathSync(resolve(process.argv[1])).toLowerCase();
    return realHere === realInvoked;
  } catch {
    return false;
  }
})();

if (isMain) {
  runCli(process.argv).catch((err) => {
    process.stderr.write(`Fatal: ${err?.message ?? err}\n`);
    if (err?.stack) process.stderr.write(`${err.stack}\n`);
    process.exit(1);
  });
}
