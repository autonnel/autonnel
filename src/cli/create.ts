import { spawnSync } from 'node:child_process';
import { rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateProjectName } from './index.js';

const TEMPLATE_REPO = 'https://github.com/autonnel/autonnel.git';

export function runCreate(args: string[]): void {
  const projectName = args.find((a) => !a.startsWith('-')) ?? 'my-funnel';

  const valid = validateProjectName(projectName);
  if (!valid.ok) {
    process.stderr.write(`Error: ${valid.reason}\n`);
    process.exit(1);
  }

  const dest = resolve(process.cwd(), projectName);
  if (existsSync(dest)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.\n`);
    process.exit(1);
  }

  process.stdout.write(`Creating "${projectName}"...\n`);

  const result = spawnSync('git', ['clone', '--depth', '1', TEMPLATE_REPO, projectName], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error || result.status !== 0) {
    process.stderr.write('Error: failed to clone template. Make sure git is installed and you have internet access.\n');
    process.exit(result.status ?? 1);
  }

  rmSync(resolve(dest, '.git'), { recursive: true, force: true });

  const pkgPath = resolve(dest, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      pkg.name = projectName;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    } catch {
      // non-fatal
    }
  }

  process.stdout.write(`\nDone! Next steps:\n\n`);
  process.stdout.write(`  cd ${projectName}\n`);
  process.stdout.write(`  cp .env.example .env    # fill in your credentials\n`);
  process.stdout.write(`  npm install\n`);
  process.stdout.write(`  npm run dev\n\n`);
}
