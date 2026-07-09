import { describe, it, expect, vi } from 'vitest';
import { markDirty, addTraitIfMissing, type GrapesEditorLike } from '@/components/grapesjs/traits/common';

describe('trait common helpers', () => {
  it('markDirty increments changesCount by 1', () => {
    const editor = {
      get: vi.fn((k: string) => (k === 'changesCount' ? 3 : undefined)),
      set: vi.fn(),
    } as unknown as GrapesEditorLike;
    markDirty(editor);
    expect(editor.set).toHaveBeenCalledWith('changesCount', 4);
  });

  it('markDirty treats missing changesCount as 0', () => {
    const editor = {
      get: vi.fn(() => undefined),
      set: vi.fn(),
    } as unknown as GrapesEditorLike;
    markDirty(editor);
    expect(editor.set).toHaveBeenCalledWith('changesCount', 1);
  });

  it('addTraitIfMissing skips when trait already present', () => {
    const component = {
      getTrait: vi.fn(() => ({ name: 'href' })),
      addTrait: vi.fn(),
    };
    addTraitIfMissing(component, { name: 'href', label: 'URL' });
    expect(component.addTrait).not.toHaveBeenCalled();
  });

  it('addTraitIfMissing adds when trait absent', () => {
    const component = {
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
    };
    addTraitIfMissing(component, { name: 'href', label: 'URL' });
    expect(component.addTrait).toHaveBeenCalledWith({ name: 'href', label: 'URL' }, undefined);
  });
});
