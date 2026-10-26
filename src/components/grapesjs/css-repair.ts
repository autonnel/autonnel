import type { Editor } from 'grapesjs';
import gjsParserPostcss from 'grapesjs-parser-postcss';

export function balanceCssBraces(css: string): string {
  let out = '';
  let depth = 0;
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      if (depth === 0) {
        i++;
        continue;
      }
      depth--;
    }
    out += ch;
    i++;
  }
  return out + '}'.repeat(depth);
}

// PostCSS is strict: one stray brace that a browser would skip throws, and GrapesJS then
// discards the whole stylesheet. Cloned pages routinely ship such CSS.
export function tolerantPostcssParser(editor: Editor): void {
  gjsParserPostcss(editor, {});
  const strict = editor.Parser.getConfig().parserCss;
  if (!strict) return;
  editor.setCustomParserCss((css, ed) => {
    try {
      return strict(css, ed);
    } catch {
      return strict(balanceCssBraces(css), ed);
    }
  });
}
