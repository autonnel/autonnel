

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

dotenv.config({ path: resolve(root, '.env') });


// localConnectionString only feeds miniflare's local Hyperdrive emulation
// (wrangler dev / astro sync). Production `wrangler deploy` uses the real
// Hyperdrive `id`, never this value. Miniflare still parses it as a URL at
// build time, so a placeholder/invalid value (e.g. DATABASE_URL="1" in CI)
// would crash the build — fall back to a syntactically valid dummy.
const DUMMY_LOCAL_PG = 'postgresql://dummy:dummy@localhost:5432/dummy';
const isValidUrl = (s) => {
  try { new URL(s); return true; } catch { return false; }
};
let localConn = process.env.CF_HYPERDRIVE_LOCAL_CONNECTION_STRING || process.env.DATABASE_URL || DUMMY_LOCAL_PG;
if (!isValidUrl(localConn)) {
  console.warn(`Warning: local Hyperdrive connection string "${localConn}" is not a valid URL; using dummy (local emulation only, does not affect production).`);
  localConn = DUMMY_LOCAL_PG;
}
process.env.CF_HYPERDRIVE_LOCAL_CONNECTION_STRING = localConn;

const templatePath = resolve(root, 'wrangler.toml.template');
let content = readFileSync(templatePath, 'utf-8');


// wrangler.toml and the runtime job registry cannot drift out of sync.

const registryPath = resolve(root, 'src/lib/cron/catalog.ts');
const registrySrc = readFileSync(registryPath, 'utf-8');
const cronMatches = [...registrySrc.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
if (cronMatches.length === 0) {
  console.error(`Error: failed to parse cron expressions from ${registryPath}`);
  process.exit(1);
}
const uniqueCrons = [...new Set(cronMatches)];
process.env.CF_CRONS = `[${uniqueCrons.map((c) => `"${c}"`).join(', ')}]`;

const missing = new Set();
content = content.replace(/\$\{(\w+)\}/g, (match, varName) => {
  const value = process.env[varName];
  if (value === undefined || value === '') {
    missing.add(varName);
    return match;
  }
  return value;
});

if (missing.size > 0) {
  console.error(`Error: env vars referenced by wrangler.toml.template are not set: ${[...missing].join(', ')}`);
  console.error('Set them in .env or as environment variables (CI: project settings).');
  process.exit(1);
}

const outputPath = resolve(root, 'wrangler.toml');
writeFileSync(outputPath, content, 'utf-8');
console.log('Generated wrangler.toml from template');
