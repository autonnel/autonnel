import { JsonToMjml, type IPage } from 'easy-email-core';
import { getCache } from '@/lib/adapters/cache';

const moduleCache = new Map<string, string>();
const DEFAULT_TTL_SECONDS = 4 * 60 * 60;

type Mjml2Html = (
  s: string,
  o?: unknown,
) => { html: string; errors: { message: string }[] };

let _mjmlPromise: Promise<Mjml2Html> | null = null;

function loadMjml(): Promise<Mjml2Html> {
  if (_mjmlPromise) return _mjmlPromise;
  _mjmlPromise = (async () => {
    const g = globalThis as { window?: unknown };
    const hadWindow = 'window' in g;
    if (!hadWindow) g.window = globalThis;
    try {
      const mod = (await import('mjml-browser')) as unknown as {
        default?: Mjml2Html;
      };
      const fn = mod.default ?? (mod as unknown as Mjml2Html);
      if (!fn) throw new Error('mjml-browser loaded but no callable export found');
      return fn;
    } finally {
      if (!hadWindow) delete g.window;
    }
  })();
  return _mjmlPromise;
}

export async function compileDesignToHtml(
  design: unknown,
  options: { cacheKey?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const { cacheKey, ttlSeconds = DEFAULT_TTL_SECONDS } = options;

  if (cacheKey) {
    const local = moduleCache.get(cacheKey);
    if (local) return local;
    const remote = await getCache().get<string>(`email-tpl:${cacheKey}`);
    if (remote) {
      moduleCache.set(cacheKey, remote);
      return remote;
    }
  }

  const mjmlString = JsonToMjml({
    data: design as IPage,
    mode: 'production',
    context: design as IPage,
  });

  const mjml2html = await loadMjml();
  const result = await mjml2html(mjmlString, { validationLevel: 'soft' });

  if (result.errors.length > 0) {
    throw new Error(
      `MJML compile failed: ${result.errors.map((e) => e.message).join(', ')}`,
    );
  }

  const html = result.html;

  if (cacheKey) {
    moduleCache.set(cacheKey, html);
    await getCache().set(`email-tpl:${cacheKey}`, html, ttlSeconds);
  }

  return html;
}

export function _resetModuleCacheForTests(): void {
  moduleCache.clear();
}
