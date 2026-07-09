export interface Block {
  type: string;
  props: { id: string; [key: string]: unknown };
}

export interface PuckDocument {
  root: { props: Record<string, unknown> };
  content: Block[];
  zones: Record<string, Block[]>;
}

function isBlock(value: unknown): value is Block {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as Record<string, unknown>;
  if (typeof b.type !== 'string') return false;
  const props = b.props as Record<string, unknown> | undefined;
  return !!props && typeof props.id === 'string';
}

export function isWellFormedDocument(value: unknown): value is PuckDocument {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  if (typeof d.root !== 'object' || d.root === null) return false;
  if (!Array.isArray(d.content) || !d.content.every(isBlock)) return false;
  if (typeof d.zones !== 'object' || d.zones === null) return false;
  return Object.values(d.zones as Record<string, unknown>).every(
    (z) => Array.isArray(z) && z.every(isBlock),
  );
}

export function allBlocks(doc: PuckDocument): Block[] {
  return [...doc.content, ...Object.values(doc.zones).flat()];
}
