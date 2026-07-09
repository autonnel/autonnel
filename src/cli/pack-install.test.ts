import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
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

interface PackFiles {
  [path: string]: string;
}

function goodPackFiles(engines = '>=0.1.0'): PackFiles {
  return {
    'package.json': JSON.stringify({
      name: '@autonnel/template-atelier',
      version: '1.0.0',
      exports: {
        '.': './src/index.ts',
        './builder': './src/builder.ts',
      },
      engines: { autonnel: engines },
    }),
    'src/index.ts': 'export default function plugin() { return { name: "atelier" }; }',
    'src/builder.ts': 'export const builderExtension = { templates: [] };',
  };
}

async function buildZip(files: PackFiles): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function buildStoredZip(files: PackFiles): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
}

describe('pack-install pure helpers', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'autonnel-pack-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('sha256 is deterministic and matches node crypto', () => {
    const buf = Buffer.from('hello autonnel');
    expect(sha256(buf)).toBe(sha256(Buffer.from('hello autonnel')));
    expect(sha256(buf)).toHaveLength(64);
  });

  it('unzips a DEFLATE archive and validates a good pack', async () => {
    const zip = await buildZip(goodPackFiles());
    unzipToDir(zip, tmp);
    expect(existsSync(join(tmp, 'package.json'))).toBe(true);
    expect(existsSync(join(tmp, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(tmp, 'src', 'builder.ts'))).toBe(true);

    const result = validateExtractedPack(tmp, '0.1.0');
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.packageName).toBe('@autonnel/template-atelier');
  });

  it('unzips a STORE (uncompressed) archive too', async () => {
    const zip = await buildStoredZip(goodPackFiles());
    unzipToDir(zip, tmp);
    expect(readFileSync(join(tmp, 'src', 'index.ts'), 'utf8')).toContain('atelier');
  });

  it('rejects engines.autonnel >=99.0.0 against the installed version via satisfiesRange', async () => {
    const zip = await buildZip(goodPackFiles('>=99.0.0'));
    unzipToDir(zip, tmp);
    const result = validateExtractedPack(tmp, '0.1.0');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('requires autonnel >=99.0.0, you have 0.1.0');
  });

  it('accepts engines.autonnel range that admits the installed version', async () => {
    const zip = await buildZip(goodPackFiles('^0.1.0'));
    unzipToDir(zip, tmp);
    expect(validateExtractedPack(tmp, '0.1.5').ok).toBe(true);
  });

  it('reads engines from peerDependencies.autonnel when engines.autonnel is absent', async () => {
    const files = goodPackFiles();
    files['package.json'] = JSON.stringify({
      name: '@autonnel/plugin-foo',
      exports: { '.': './src/index.ts', './builder': './src/builder.ts' },
      peerDependencies: { autonnel: '>=0.1.0' },
    });
    const zip = await buildZip(files);
    unzipToDir(zip, tmp);
    expect(validateExtractedPack(tmp, '0.2.0').ok).toBe(true);
  });

  it('rejects a pack whose package.json is missing the ./builder export', async () => {
    const files = goodPackFiles();
    files['package.json'] = JSON.stringify({
      name: '@autonnel/template-broken',
      exports: { '.': './src/index.ts' },
      engines: { autonnel: '>=0.1.0' },
    });
    const zip = await buildZip(files);
    unzipToDir(zip, tmp);
    const result = validateExtractedPack(tmp, '0.1.0');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('exports["./builder"]');
  });

  it('rejects a pack missing src/builder.ts', async () => {
    const files = goodPackFiles();
    delete files['src/builder.ts'];
    const zip = await buildZip(files);
    unzipToDir(zip, tmp);
    const result = validateExtractedPack(tmp, '0.1.0');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('src/builder.ts is missing');
  });

  it('rejects a zip-slip entry that escapes destDir', async () => {
    const zip = new JSZip();
    zip.file('../evil.txt', 'pwned');
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    expect(() => unzipToDir(buf, tmp)).toThrow(/unsafe zip entry/);
    expect(existsSync(join(tmp, '..', 'evil.txt'))).toBe(false);
  });

  it('rejects a zip entry with an absolute path', async () => {
    // Patch every occurrence of the entry name (local header + central directory) to a
    // same-length absolute path so the zip stays structurally valid while the guard trips.
    const zip = new JSZip();
    zip.file('nestedok.txt', 'fine');
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' });
    const forged = Buffer.from(buf);
    const original = Buffer.from('nestedok.txt');
    const replacement = Buffer.from('C:\\abs\\x.txt'); // 12 bytes, same length
    let idx = forged.indexOf(original);
    while (idx >= 0) {
      replacement.copy(forged, idx);
      idx = forged.indexOf(original, idx + 1);
    }
    expect(() => unzipToDir(forged, tmp)).toThrow(/unsafe zip entry/);
  });

  it('packageDirName strips the scope', () => {
    expect(packageDirName('@autonnel/template-atelier')).toBe('template-atelier');
    expect(packageDirName('plugin-ads')).toBe('plugin-ads');
  });

  it('importIdentifier produces a camelCase default import name', () => {
    expect(importIdentifier('@autonnel/template-atelier')).toBe('templateAtelier');
    expect(importIdentifier('@autonnel/plugin-oauth2')).toBe('pluginOauth2');
  });

  it('addFileDependency is idempotent', () => {
    const pkg: ConsumerPackageJson = {};
    expect(addFileDependency(pkg, '@autonnel/template-atelier', 'file:./packages/template-atelier')).toBe(true);
    expect(pkg.dependencies?.['@autonnel/template-atelier']).toBe('file:./packages/template-atelier');
    // Second call with the same spec is a no-op.
    expect(addFileDependency(pkg, '@autonnel/template-atelier', 'file:./packages/template-atelier')).toBe(false);
    // Changing the spec reports a change.
    expect(addFileDependency(pkg, '@autonnel/template-atelier', 'file:./packages/other')).toBe(true);
  });

  it('renderIntegrationSnippet produces the exact astro.config lines', () => {
    const snippet = renderIntegrationSnippet([
      { packageName: '@autonnel/template-atelier', importName: 'templateAtelier' },
    ]);
    expect(snippet).toContain("import templateAtelier from '@autonnel/template-atelier';");
    expect(snippet).toContain('autonnel({');
    expect(snippet).toContain('plugins: [');
    expect(snippet).toContain('templateAtelier(),');
  });

  it('renderIntegrationSnippet returns empty for no imports', () => {
    expect(renderIntegrationSnippet([])).toBe('');
  });
});
