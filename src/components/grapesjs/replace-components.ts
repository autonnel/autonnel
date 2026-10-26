import type { Editor } from 'grapesjs';

// editor.setComponents() clears the tree first, and removing a component deletes every rule
// whose selector is exactly its `#id`. resetFromString() keeps the rules of ids that survive.
export function replaceComponents(editor: Editor, html: string): void {
  editor.getWrapper()?.components().resetFromString(html);
}
