#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const REQUIRED = [
  'dist/integration/index.js',
  'dist/integration/index.d.ts',
  'dist/cli/index.js',
  'dist/lib/hooks/index.js',
  'dist/lib/tenant/index.js',
  'dist/lib/api-helpers.js',
];

const result = spawnSync(
  'npx',
  ['tsc', '-p', 'tsconfig.build.json'],
  { cwd: repoRoot, stdio: 'inherit', shell: true }
);

const missing = REQUIRED.filter((p) => !existsSync(resolve(repoRoot, p)));
if (missing.length > 0) {
  console.error('\nbuild:package failed — missing expected output files:');
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

if (result.status !== 0) {
  console.warn('\nbuild:package: tsc exited with errors but all required outputs were emitted.');
  console.warn('Run `npx tsc -p tsconfig.build.json` to inspect the errors.');
}

const fixResult = spawnSync(
  'node',
  ['scripts/fix-esm-extensions.mjs'],
  { cwd: repoRoot, stdio: 'inherit', shell: true }
);
if (fixResult.status !== 0) {
  console.error('build:package: fix-esm-extensions failed');
  process.exit(1);
}

console.log('\nbuild:package: dist artifacts emitted.');
