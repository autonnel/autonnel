import { tagHtmlWithAids, stripAids } from '@/lib/ai/aid-utils';
import type { Editor } from 'grapesjs';

export function assignAidsToHtml(html: string): string {
  return tagHtmlWithAids(html);
}

export function stripAidsFromHtml(html: string): string {
  return stripAids(html);
}

export function assignAids(editor: Editor): void {
  const html = editor.getHtml();
  const tagged = tagHtmlWithAids(html);
  editor.setComponents(tagged);
}

export function stripAidsFromEditor(editor: Editor): void {
  const html = editor.getHtml();
  const stripped = stripAids(html);
  editor.setComponents(stripped);
}
