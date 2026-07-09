import { GJS_TEXT_PARENT_TAGS, INLINE_TAGS } from './html-extract';

export const INLINE_TEXT_TYPE = {
  extend: 'text',
  model: {
    defaults: {
      editable: true,
    },
  },
  isComponent(el: any) {
    if (!el || !el.tagName) return false;
    const tag = String(el.tagName).toUpperCase();
    if (!INLINE_TAGS.has(tag)) return false;
    const parent = el.parentElement;
    if (parent && parent.tagName) {
      const parentTag = String(parent.tagName).toUpperCase();
      if (GJS_TEXT_PARENT_TAGS.has(parentTag) || INLINE_TAGS.has(parentTag)) {
        return false;
      }
    }
    return { type: 'inline-text' };
  },
} as any;

export const NATIVE_PANE_SELECTORS = [
  '.gjs-blocks-c',
  '.gjs-sm-sectors',
  '.gjs-trt-traits',
  '.gjs-clm-tags',
  '.gjs-lm-content',
];

export function hideNativePane(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.dataset.gjsHiddenByAgent = '1';
    el.style.display = 'none';
  });
}

export function showNativePane(selector: string) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (el.dataset.gjsHiddenByAgent === '1') {
      delete el.dataset.gjsHiddenByAgent;
      el.style.display = '';
    }
  });
}
