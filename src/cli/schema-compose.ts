import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { composePluginSchema } from '@/lib/plugins/schema-extension';
import type { AutonnelPlugin } from '@/lib/plugins/types';

interface ComposeOptions {
  pluginsModule: string;
  outDir: string;
}

function parseArgs(args: string[]): ComposeOptions {
  const opts: ComposeOptions = { pluginsModule: 'src/plugins.ts', outDir: 'prisma/schema' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plugins') opts.pluginsModule = args[++i];
    else if (args[i] === '--out') opts.outDir = args[++i];
    else throw new Error(`unknown option ${args[i]}`);
  }
  return opts;
}

// The plugins module is bundler-style TS (extensionless imports, linked workspace packages), so it is
// loaded through the consumer's own Vite rather than Node.
async function loadVite(root: string): Promise<{ runnerImport: (id: string, config?: object) => Promise<{ module: any }> }> {
  const consumer = createRequire(join(root, 'package.json'));
  let entry: string;
  try {
    entry = consumer.resolve('vite');
  } catch {
    entry = createRequire(consumer.resolve('astro/package.json')).resolve('vite');
  }
  return import(pathToFileURL(entry).href);
}

export async function loadPlugins(root: string, pluginsModule: string): Promise<AutonnelPlugin[]> {
  const file = isAbsolute(pluginsModule) ? pluginsModule : resolve(root, pluginsModule);
  if (!existsSync(file)) throw new Error(`plugins module not found: ${file}`);
  const { runnerImport } = await loadVite(root);
  const { module } = await runnerImport(file, { root, configFile: false, logLevel: 'error' });
  const plugins = typeof module.createPlugins === 'function' ? module.createPlugins() : module.plugins;
  if (!Array.isArray(plugins)) throw new Error(`${pluginsModule} must export createPlugins() or a plugins array`);
  return plugins;
}

export function readCoreSchema(): string {
  return readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../prisma/schema.prisma'), 'utf8');
}

export async function runSchemaCompose(args: string[]): Promise<void> {
  const opts = parseArgs(args);
  const root = process.cwd();
  const plugins = await loadPlugins(root, opts.pluginsModule);
  const fragments = plugins
    .filter((p) => p.schemaExtension)
    .map((p) => ({ pluginName: p.name, schema: p.schemaExtension! }));
  const files = composePluginSchema(readCoreSchema(), fragments);

  const outDir = resolve(root, opts.outDir);
  mkdirSync(outDir, { recursive: true });
  for (const stale of readdirSync(outDir).filter((f) => f.endsWith('.prisma') && !(f in files))) {
    rmSync(join(outDir, stale));
  }
  for (const [name, content] of Object.entries(files)) writeFileSync(join(outDir, name), content);

  const names = fragments.map((f) => f.pluginName);
  process.stdout.write(
    `schema:compose wrote ${Object.keys(files).length} file(s) to ${opts.outDir}` +
      (names.length ? ` (plugin schemas: ${names.join(', ')})\n` : ' (no plugin schemas)\n'),
  );
}
