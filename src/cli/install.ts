import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  MarketplaceClient,
  MarketplaceError,
  readCredentials,
} from './marketplace-client.js';
import { getEntitlements } from './orders.js';
import {
  sha256,
  unzipToDir,
  validateExtractedPack,
  packageDirName,
  addFileDependency,
  renderIntegrationSnippet,
  importIdentifier,
  type ConsumerPackageJson,
} from './pack-install.js';

interface InstallArgs {
  base?: string;
  item?: string;
  version?: string;
}

function parseArgs(args: string[]): InstallArgs {
  const out: InstallArgs = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) out.base = args[++i];
    else if (args[i].startsWith('--base=')) out.base = args[i].slice('--base='.length);
    else if (args[i] === '--version' && args[i + 1]) out.version = args[++i];
    else if (args[i].startsWith('--version=')) out.version = args[i].slice('--version='.length);
    else positional.push(args[i]);
  }
  out.item = positional[0];
  return out;
}

// The engines.autonnel gate must check the CONSUMER's installed autonnel, not the CLI's
// own version — a consumer may pin a different autonnel than the CLI was published with.
function resolveConsumerAutonnelVersion(consumerRoot: string): string | null {
  const pkgPath = join(consumerRoot, 'node_modules', 'autonnel', 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}

// A consumer may keep astro.config.mjs OR astro.config.cloudflare.mjs (deploy-example
// ships both). We never AST-rewrite the build-time config graph; we just tailor the
// printed instruction to whichever file(s) exist.
function detectAstroConfigs(consumerRoot: string): string[] {
  return ['astro.config.mjs', 'astro.config.cloudflare.mjs', 'astro.config.ts'].filter((f) =>
    existsSync(join(consumerRoot, f)),
  );
}

export interface RunInstallDeps {
  consumerRoot: string;
  client?: MarketplaceClient;
  log?: (msg: string) => void;
  fetchImpl?: (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
  consumerAutonnelVersion?: string | null;
}

export async function runInstallWith(args: string[], deps: RunInstallDeps): Promise<boolean> {
  const parsed = parseArgs(args);
  const log = deps.log ?? ((m: string) => process.stdout.write(m + '\n'));
  const client = deps.client ?? new MarketplaceClient({ base: parsed.base });

  if (!parsed.item) {
    log('Usage: npx autonnel install <item> [--version <v>]');
    return false;
  }

  const creds = readCredentials(deps.consumerRoot);
  const entitlements = await getEntitlements(creds, client);
  if (!entitlements.ok) {
    log(entitlements.message ?? 'Run: npx autonnel authorize');
    return false;
  }

  const owned = (entitlements.items ?? []).find(
    (e) => e.item === parsed.item || e.slug === parsed.item,
  );
  if (!owned) {
    log(`You have not purchased "${parsed.item}".`);
    log('Run `npx autonnel orders` to see what you own, or buy it on the marketplace.');
    return false;
  }

  let download;
  try {
    download = await client.requestDownloadUrl(creds!.accessToken, {
      item: parsed.item,
      version: parsed.version,
    });
  } catch (err) {
    const status = err instanceof MarketplaceError ? err.status : undefined;
    if (status === 403) log('You are not entitled to download this item.');
    else if (status === 404) log('No built artifact exists for the requested version.');
    else if (status === 503) log('The marketplace download service is currently unavailable.');
    else log(`Download request failed: ${(err as Error).message}`);
    return false;
  }

  log(`Downloading ${parsed.item}@${download.version}...`);
  const fetchImpl =
    deps.fetchImpl ?? ((url: string) => fetch(url) as Promise<Response>);
  const res = await fetchImpl(download.url);
  if (!res.ok) {
    log(`Download failed (HTTP ${res.status}).`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());

  // Verify integrity BEFORE extracting — never write attacker-controlled bytes to disk.
  const actual = sha256(buf);
  if (actual !== download.sha256) {
    log('Integrity check failed: the downloaded archive does not match its expected sha256.');
    return false;
  }

  const dirName = packageDirName(owned.item ?? owned.slug);
  const destDir = join(deps.consumerRoot, 'packages', dirName);
  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  try {
    unzipToDir(buf, destDir);
  } catch (err) {
    rmSync(destDir, { recursive: true, force: true });
    log(`Extraction failed: ${(err as Error).message}`);
    return false;
  }

  const installedVersion =
    deps.consumerAutonnelVersion !== undefined
      ? deps.consumerAutonnelVersion
      : resolveConsumerAutonnelVersion(deps.consumerRoot);
  if (!installedVersion) {
    rmSync(destDir, { recursive: true, force: true });
    log('Could not resolve the installed autonnel version (node_modules/autonnel/package.json).');
    log('Run `npm install` in this project first, then retry.');
    return false;
  }

  const validation = validateExtractedPack(destDir, installedVersion);
  if (!validation.ok) {
    rmSync(destDir, { recursive: true, force: true });
    log('The downloaded pack failed validation:');
    for (const e of validation.errors) log(`  - ${e}`);
    return false;
  }

  const packageName = validation.packageName ?? owned.item ?? owned.slug;
  const fileSpec = `file:./packages/${dirName}`;
  mergeConsumerDependency(deps.consumerRoot, packageName, fileSpec, log);

  log('');
  log(`Installed ${packageName}@${download.version} into packages/${dirName}`);
  log('');
  log('Add this to your astro.config to enable the pack:');
  log('');
  log(renderIntegrationSnippet([{ packageName, importName: importIdentifier(packageName) }]));
  log('');

  const configs = detectAstroConfigs(deps.consumerRoot);
  if (configs.length > 1) {
    log(`Apply the same change to each config file: ${configs.join(', ')}`);
    log('');
  } else if (configs.length === 1) {
    log(`Edit: ${configs[0]}`);
    log('');
  }
  log('Next: npm install && npm run build');
  return true;
}

function mergeConsumerDependency(
  consumerRoot: string,
  name: string,
  fileSpec: string,
  log: (msg: string) => void,
): void {
  const pkgPath = join(consumerRoot, 'package.json');
  if (!existsSync(pkgPath)) {
    log('Warning: consumer package.json not found; skipping dependency merge.');
    return;
  }
  let pkg: ConsumerPackageJson;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as ConsumerPackageJson;
  } catch {
    log('Warning: consumer package.json is not valid JSON; skipping dependency merge.');
    return;
  }
  const changed = addFileDependency(pkg, name, fileSpec);
  if (changed) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

export async function runInstall(args: string[]): Promise<void> {
  const { resolveConsumerRoot } = await import('./index.js');
  const consumerRoot = resolveConsumerRoot();
  const ok = await runInstallWith(args, { consumerRoot });
  if (!ok) process.exit(1);
}
