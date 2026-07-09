import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface InjectableRoute {
  pattern: string;
  entrypoint: string;
}

// Derive the Astro route pattern from a path under src/pages.
// 'overview.astro' -> '/overview'; 'orders/index.astro' -> '/orders';
// 'api/permissions/roles/[id].ts' -> '/api/permissions/roles/[id]'; 'index.astro' -> '/'.
function derivePattern(relPath: string): string {
  let p = relPath.replace(/\\/g, '/').replace(/\.(astro|ts|js)$/, '');
  p = p.replace(/\/index$/, '');
  if (p === 'index') p = '';
  return '/' + p;
}

function walk(dir: string, base: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    // Astro ignores leading-underscore files/dirs; skip dotfiles too.
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) {
      walk(full, rel, out);
      continue;
    }
    if (!/\.(astro|ts|js)$/.test(name)) continue;
    if (/\.test\.(ts|js)$/.test(name)) continue;
    if (/\.d\.ts$/.test(name)) continue;
    if (name === '404.astro') continue; // consumer owns its own 404
    out.push(rel);
  }
}

// Enumerate every routable page/endpoint shipped in the package's src/pages, returning the
// Astro pattern + a bare-specifier entrypoint (resolved via the package's "./pages/*" export).
export function enumerateCoreRoutes(integrationUrl: string): InjectableRoute[] {
  const pagesRel = integrationUrl.includes('/dist/') ? '../../src/pages/' : '../pages/';
  const pagesDir = fileURLToPath(new URL(pagesRel, integrationUrl));
  const files: string[] = [];
  walk(pagesDir, '', files);
  return files.map((rel) => ({
    pattern: derivePattern(rel),
    entrypoint: `autonnel/pages/${rel.replace(/\\/g, '/')}`,
  }));
}

export function filterRoutes(routes: InjectableRoute[], exclude: string[]): InjectableRoute[] {
  if (!exclude || exclude.length === 0) return routes;
  const set = new Set(exclude);
  return routes.filter((r) => !set.has(r.pattern));
}
