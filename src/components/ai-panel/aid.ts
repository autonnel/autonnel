import { tagHtmlWithAids, stripAids } from '@/lib/ai/aid-utils';
import type { Editor } from 'grapesjs';
import { replaceComponents } from '@/components/grapesjs/replace-components';

export function assignAidsToHtml(html: string): string {
  return tagHtmlWithAids(html);
}

export function stripAidsFromHtml(html: string): string {
  return stripAids(html);
}

export function assignAids(editor: Editor): void {
  const html = editor.getHtml();
  const tagged = tagHtmlWithAids(html);
  replaceComponents(editor, tagged);
}

export function stripAidsFromEditor(editor: Editor): void {
  const html = editor.getHtml();
  const stripped = stripAids(html);
  replaceComponents(editor, stripped);
}
