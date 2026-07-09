import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { runInstallWith } from './install.js';
import { sha256 } from './pack-install.js';
import {
  MarketplaceClient,
  writeCredentials,
  type FetchFn,
} from './marketplace-client.js';

async function buildPackZip(engines = '>=0.1.0'): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'package.json',
    JSON.stringify({
      name: '@autonnel/template-atelier',
      version: '1.0.0',
      exports: { '.': './src/index.ts', './builder': './src/builder.ts' },
      engines: { autonnel: engines },
    }),
  );
  zip.file('src/index.ts', 'export default () => ({ name: "atelier" });');
  zip.file('src/builder.ts', 'export const builderExtension = { templates: [] };');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

interface ApiCtx {
  zip: Buffer;
  sha: string;
  ordersItem?: string;
}

// One injected fetch standing in for both the marketplace JSON API and the presigned host.
function apiFetch(ctx: ApiCtx): FetchFn {
  return async (url, init) => {
    if (url.endsWith('/api/cli/orders')) {
      return new Response(
        JSON.stringify({
          items: [
            {
              item: ctx.ordersItem ?? '@autonnel/template-atelier',
              slug: 'template-atelier',
              kind: 'template',
              version: '1.0.0',
              orderToken: 'ot_1',
              purchasedAt: '2026-06-20T00:00:00.000Z',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/cli/download-url')) {
      const body = JSON.parse((init?.body as string) ?? '{}') as { item?: string };
      if (body.item !== '@autonnel/template-atelier' && body.item !== 'template-atelier') {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
      }
      return new Response(
        JSON.stringify({
          url: 'http://s3.test/presigned?X-Amz-Signature=abc',
          key: '_platform/templates/template-atelier/1.0.0/index.zip',
          version: '1.0.0',
          sha256: ctx.sha,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    throw new Error(`unexpected url ${url}`);
  };
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

function seedConsumer(root: string, autonnelVersion = '0.1.0'): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'my-funnel', dependencies: {} }, null, 2));
  writeFileSync(join(root, 'astro.config.mjs'), "import autonnel from 'autonnel';\nexport default { integrations: [autonnel()] };\n");
  const modDir = join(root, 'node_modules', 'autonnel');
  mkdirSync(modDir, { recursive: true });
  writeFileSync(join(modDir, 'package.json'), JSON.stringify({ name: 'autonnel', version: autonnelVersion }));
}

describe('runInstallWith integration (offline)', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'autonnel-install-'));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('downloads, sha256-verifies, extracts, merges file: dep, and prints the snippet', async () => {
    seedConsumer(tmp);
    writeCredentials(tmp, {
      accessToken: 'AT',
      tokenType: 'Bearer',
      scope: 'marketplace:read marketplace:download',
      issuer: 'http://h',
      obtainedAt: new Date().toISOString(),
    });
    const zip = await buildPackZip();
    const ctx: ApiCtx = { zip, sha: sha256(zip) };
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch(ctx) });

    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/template-atelier'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(zip) }),
    });

    expect(ok).toBe(true);
    const dest = join(tmp, 'packages', 'template-atelier');
    expect(existsSync(join(dest, 'src', 'index.ts'))).toBe(true);
    expect(existsSync(join(dest, 'src', 'builder.ts'))).toBe(true);

    const consumerPkg = JSON.parse(readFileSync(join(tmp, 'package.json'), 'utf8'));
    expect(consumerPkg.dependencies['@autonnel/template-atelier']).toBe('file:./packages/template-atelier');

    const out = logs.join('\n');
    expect(out).toContain("import templateAtelier from '@autonnel/template-atelier';");
    expect(out).toContain('templateAtelier(),');
    expect(out).toContain('npm install && npm run build');
    expect(out).toContain('astro.config.mjs');
  });

  it('aborts and does not extract when sha256 does not match', async () => {
    seedConsumer(tmp);
    writeCredentials(tmp, { accessToken: 'AT', tokenType: 'Bearer', scope: '', issuer: 'http://h', obtainedAt: '' });
    const zip = await buildPackZip();
    const ctx: ApiCtx = { zip, sha: 'deadbeef'.repeat(8) }; // wrong sha advertised by API
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch(ctx) });
    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/template-atelier'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(zip) }),
    });
    expect(ok).toBe(false);
    expect(existsSync(join(tmp, 'packages', 'template-atelier'))).toBe(false);
    expect(logs.join('\n')).toContain('Integrity check failed');
  });

  it('rejects a zip-slip pack and cleans up the dest dir', async () => {
    seedConsumer(tmp);
    writeCredentials(tmp, { accessToken: 'AT', tokenType: 'Bearer', scope: '', issuer: 'http://h', obtainedAt: '' });
    const zip = new JSZip();
    zip.file('../escape.txt', 'pwned');
    zip.file('package.json', '{}');
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const ctx: ApiCtx = { zip: buf, sha: sha256(buf) };
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch(ctx) });
    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/template-atelier'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(buf) }),
    });
    expect(ok).toBe(false);
    expect(existsSync(join(tmp, 'packages', 'template-atelier'))).toBe(false);
    expect(existsSync(join(tmp, 'packages', 'escape.txt'))).toBe(false);
    expect(logs.join('\n')).toContain('Extraction failed');
  });

  it('aborts on engines.autonnel mismatch with a clear message and cleans up', async () => {
    seedConsumer(tmp, '0.1.0');
    writeCredentials(tmp, { accessToken: 'AT', tokenType: 'Bearer', scope: '', issuer: 'http://h', obtainedAt: '' });
    const zip = await buildPackZip('>=99.0.0');
    const ctx: ApiCtx = { zip, sha: sha256(zip) };
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch(ctx) });
    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/template-atelier'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      consumerAutonnelVersion: '0.1.0',
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(zip) }),
    });
    expect(ok).toBe(false);
    expect(existsSync(join(tmp, 'packages', 'template-atelier'))).toBe(false);
    expect(logs.join('\n')).toContain('requires autonnel >=99.0.0, you have 0.1.0');
  });

  it('refuses an item the user has not purchased', async () => {
    seedConsumer(tmp);
    writeCredentials(tmp, { accessToken: 'AT', tokenType: 'Bearer', scope: '', issuer: 'http://h', obtainedAt: '' });
    const zip = await buildPackZip();
    const ctx: ApiCtx = { zip, sha: sha256(zip), ordersItem: '@autonnel/template-other' };
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch(ctx) });
    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/plugin-ads'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(zip) }),
    });
    expect(ok).toBe(false);
    expect(logs.join('\n')).toContain('not purchased');
  });

  it('instructs the user to authorize when no credentials exist', async () => {
    seedConsumer(tmp);
    const client = new MarketplaceClient({ base: 'http://h', fetchImpl: apiFetch({ zip: Buffer.alloc(0), sha: '' }) });
    const logs: string[] = [];
    const ok = await runInstallWith(['@autonnel/template-atelier'], {
      consumerRoot: tmp,
      client,
      log: (m) => logs.push(m),
    });
    expect(ok).toBe(false);
    expect(logs.join('\n')).toContain('npx autonnel authorize');
  });
});
