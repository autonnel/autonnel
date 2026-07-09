export const INTER_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap';

export const NATIVE_VIEW_COMMANDS = ['open-blocks', 'open-sm', 'open-tm', 'open-layers'];

export const GJS_TEXT_PARENT_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE',
]);

export const INLINE_TAGS = new Set([
  'SPAN', 'B', 'I', 'STRONG', 'EM', 'U', 'SMALL', 'SUB', 'SUP', 'LABEL',
]);

export function extractStylesheetHrefs(headHtml: string): string[] {
  const urls: string[] = [];
  const linkRe = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  const hrefRe = /href=["']([^"']+)["']/i;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(headHtml)) !== null) {
    const hrefMatch = m[0].match(hrefRe);
    if (hrefMatch) urls.push(hrefMatch[1]);
  }
  const hrefFirstRe = /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  while ((m = hrefFirstRe.exec(headHtml)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

export function extractScripts(html: string): { withoutScripts: string; scripts: string[] } {
  const scripts: string[] = [];
  const withoutScripts = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    scripts.push(match);
    return '';
  });
  return { withoutScripts, scripts };
}

export function extractInlineStyles(html: string): { withoutStyles: string; css: string } {
  let css = '';
  const withoutStyles = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, body) => {
    css += body;
    return '';
  });
  return { withoutStyles, css };
}

export function extractHeadStyleBlocks(headHtml: string): string[] {
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(headHtml)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}
