#!/usr/bin/env node
// Wraps the Cloudflare build so users don't need to set NODE_OPTIONS in
// single workerd bundle peaks well above the 2 GB Node default heap.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const NODE_OPTIONS = [
  process.env.NODE_OPTIONS ?? '',
  '--max-old-space-size=4096',
].join(' ').trim();

const env = { ...process.env, NODE_OPTIONS };

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('npx', ['prisma', 'generate']);
run('node', ['scripts/generate-wrangler.mjs']);
run('npx', ['astro', 'build', '--config', 'astro.config.cloudflare.mjs']);
