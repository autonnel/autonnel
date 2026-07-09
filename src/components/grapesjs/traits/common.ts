export interface GrapesEditorLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

export interface ComponentLike {
  getTrait(name: string): unknown;
  addTrait(spec: TraitSpec | TraitSpec[], opts?: { at?: number }): void;
  get?(key: string): unknown;
  getAttributes?(): Record<string, unknown>;
  addAttributes?(attrs: Record<string, unknown>): void;
}

export interface TraitSpec {
  type?: string;
  name: string;
  label?: string;
  placeholder?: string;
  options?: Array<{ id: string; name?: string; label?: string; value?: string }>;
  default?: unknown;
}

export function markDirty(editor: GrapesEditorLike): void {
  const count = (editor.get('changesCount') as number | undefined) ?? 0;
  editor.set('changesCount', count + 1);
}

export function addTraitIfMissing(
  component: ComponentLike,
  spec: TraitSpec,
  opts?: { at?: number },
): void {
  if (component.getTrait(spec.name)) return;
  component.addTrait(spec, opts);
}
