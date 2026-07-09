#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'dist');

const IMPORT_RE = /(\bfrom\s+['"]|\bimport\s*\(\s*['"]|\bimport\s+['"])([^'"]+?)(['"])/g;

function looksLikeFile(absPath) {
  try {
    return statSync(absPath).isFile();
  } catch {
    return false;
  }
}

function toRelative(fromDir, absTarget) {
  let rel = relative(fromDir, absTarget).replaceAll('\\', '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

function resolveSpec(fileDir, spec, decl = false) {
  // Declaration files import `.js` specifiers (bundler resolution maps the sibling
  // `.d.ts`); resolve against emitted `.d.ts` so external consumers do not see the
  // build-internal `@/` alias unresolved.
  const ext = decl ? '.d.ts' : '.js';
  if (spec.startsWith('@/')) {
    const targetBase = resolve(distDir, spec.slice(2));
    if (looksLikeFile(targetBase + ext)) return toRelative(fileDir, targetBase + '.js');
    if (looksLikeFile(join(targetBase, 'index' + ext))) return toRelative(fileDir, join(targetBase, 'index.js'));
    return null;
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    if (/\.(js|mjs|cjs|json|css|wasm)$/.test(spec)) return null;
    const baseAbs = resolve(fileDir, spec);
    if (looksLikeFile(baseAbs + ext)) return spec + '.js';
    if (looksLikeFile(join(baseAbs, 'index' + ext))) return spec.replace(/\/$/, '') + '/index.js';
    return null;
  }
  return null;
}

function rewrite(filePath) {
  const fileDir = dirname(filePath);
  const decl = filePath.endsWith('.d.ts');
  const original = readFileSync(filePath, 'utf8');
  const fixed = original.replace(IMPORT_RE, (full, prefix, spec, suffix) => {
    const replacement = resolveSpec(fileDir, spec, decl);
    if (replacement === null) return full;
    return prefix + replacement + suffix;
  });
  if (fixed !== original) {
    writeFileSync(filePath, fixed);
    return true;
  }
  return false;
}

let total = 0;
let changed = 0;
for await (const entry of glob('**/*.{js,mjs,d.ts}', { cwd: distDir, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  total++;
  const full = join(entry.parentPath ?? entry.path, entry.name);
  if (rewrite(full)) changed++;
}

console.log(`[fix-esm-extensions] processed ${total} files, rewrote ${changed}`);
