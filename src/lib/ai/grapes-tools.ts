import * as cheerio from 'cheerio';
import { tool } from 'ai';
import { z } from 'zod';
import { stripAids } from './aid-utils';
import { randomPid, stripPids } from './pid-utils';

export interface GrapesToolsOptions {
  stylingAllowed?: boolean;
}

const DANGEROUS_CSS_PATTERNS: ReadonlyArray<RegExp> = [
  /position\s*:\s*fixed/i,
  /\binset\s*:\s*0/i,
  /\bz-index\s*:\s*[1-9]\d{2,}/i,
  /\b(?:width|height)\s*:\s*100v[wh]/i,
];

const DANGEROUS_HTML_PATTERNS: ReadonlyArray<RegExp> = [
  /position\s*:\s*fixed/i,
  /\binset\s*:\s*0/i,
  /\b(?:width|height)\s*:\s*100v[wh]/i,
];

function findDangerousMatch(input: string, patterns: ReadonlyArray<RegExp>): string | null {
  for (const p of patterns) {
    if (p.test(input)) return p.source;
  }
  return null;
}

export function createGrapesTools(
  initialHtml: string,
  initialCss: string,
  options: GrapesToolsOptions = {},
) {
  const stylingAllowed = options.stylingAllowed ?? false;
  const $ = cheerio.load(initialHtml, null, false);
  let css = initialCss;

  const getCurrentPage = tool({
    description:
      'Returns the current page HTML (with data-aid attributes) and CSS. Call this first if you need a fresh snapshot.',
    inputSchema: z.object({}),
    execute: async () => ({ html: $.html(), css }),
  });

  const rewriteText = tool({
    description:
      'Rewrite the visible text of an element by its data-aid. Preserves child structure ' +
      'when possible — use this for headings, paragraphs, buttons. For complex children, use replaceSection.',
    inputSchema: z.object({
      aid: z.string(),
      text: z.string(),
    }),
    execute: async ({ aid, text }: { aid: string; text: string }) => {
      const $el = $(`[data-aid="${aid}"]`);
      if (!$el.length) return { error: `aid ${aid} not found` };
      const oldText = $el.text();
      $el.text(text);
      return { rewritten: aid, removed: oldText.length, added: text.length, unit: 'chars' };
    },
  });

  const replaceSection = tool({
    description:
      'Replace the entire outerHTML of an element by its data-aid with new HTML. ' +
      'Use for swapping hero, section, footer blocks. Do not call on <body> or page root. ' +
      'Forbidden: new HTML containing position:fixed, inset:0, 100vw/100vh, or any full-screen overlay.',
    inputSchema: z.object({
      aid: z.string(),
      html: z.string(),
    }),
    execute: async ({ aid, html }: { aid: string; html: string }) => {
      const $el = $(`[data-aid="${aid}"]`);
      if (!$el.length) return { error: `aid ${aid} not found` };
      const danger = findDangerousMatch(html, DANGEROUS_HTML_PATTERNS);
      if (danger) {
        return {
          error: `replaceSection rejected: new HTML contains a full-screen / fixed-position pattern (${danger}). Use plain in-flow markup only.`,
        };
      }
      const oldOuter = $.html($el) ?? '';
      $el.replaceWith(html);
      return { replaced: aid, removed: oldOuter.length, added: html.length, unit: 'chars' };
    },
  });

  const appendCss = tool({
    description: stylingAllowed
      ? 'Append CSS rules to the page stylesheet. Use only for visual tweaks (color, spacing, fonts) that the user asked for. Forbidden: position:fixed, inset:0, z-index over 99, 100vw/100vh, body/html backgrounds that dim the page.'
      : 'DISABLED. The user did not ask for any visual / style change in this request. Do NOT call this tool — calling it will be rejected. Use rewriteText or replaceSection only.',
    inputSchema: z.object({ css: z.string() }),
    execute: async ({ css: newCss }: { css: string }) => {
      if (!stylingAllowed) {
        return {
          error: 'appendCss is disabled for this request because the user did not ask for visual / style changes. Use rewriteText or replaceSection instead.',
        };
      }
      const danger = findDangerousMatch(newCss, DANGEROUS_CSS_PATTERNS);
      if (danger) {
        return {
          error: `appendCss rejected: contains a full-screen / fixed-position pattern (${danger}). Use plain in-flow CSS only.`,
        };
      }
      css = css + '\n' + newCss;
      return { added: newCss.length, removed: 0, unit: 'chars' };
    },
  });

  const imagePrompts: Record<string, string> = {};

  const setImagePrompt = tool({
    description:
      'Save a generation prompt for an <img> or <video> element by its data-aid. ' +
      'The prompt is stored as page sidecar metadata (never written into the HTML). ' +
      'Use this when the user asks you to write image prompts, or when a sweeping ' +
      'rewrite implies the existing media should also be re-generated to match. ' +
      'You may call this for every media element on the page. The prompt should be ' +
      'a single descriptive English sentence suitable for an image generation model.',
    inputSchema: z.object({
      aid: z.string(),
      prompt: z.string(),
    }),
    execute: async ({ aid, prompt }: { aid: string; prompt: string }) => {
      const $el = $(`[data-aid="${aid}"]`);
      if (!$el.length) return { error: `aid ${aid} not found` };
      const tag = $el.prop('tagName')?.toLowerCase();
      if (tag !== 'img' && tag !== 'video') {
        return { error: `aid ${aid} is not an image or video (tag=${tag})` };
      }
      let pid = $el.attr('data-pid');
      if (!pid) {
        pid = randomPid();
        $el.attr('data-pid', pid);
      }
      const oldPrompt = imagePrompts[pid] ?? '';
      imagePrompts[pid] = prompt;
      return { ok: pid, removed: oldPrompt.length, added: prompt.length, unit: 'chars' };
    },
  });

  return {
    tools: { getCurrentPage, rewriteText, replaceSection, appendCss, setImagePrompt },
    getFinalState: () => ({
      html: stripPids(stripAids($.html())),
      css,
      imagePrompts: { ...imagePrompts },
    }),
  };
}
