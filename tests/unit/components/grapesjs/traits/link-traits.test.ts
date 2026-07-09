import { describe, it, expect, vi } from 'vitest';
import { registerLinkTraits } from '@/components/grapesjs/traits/link-traits';

function makeEditor() {
  const listeners: Record<string, Function[]> = {};
  const types: Record<string, any> = {};
  return {
    listeners,
    types,
    DomComponents: {
      addType: vi.fn((name: string, def: any) => { types[name] = def; }),
    },
    on: vi.fn((event: string, fn: Function) => {
      (listeners[event] ||= []).push(fn);
    }),
  } as any;
}

describe('registerLinkTraits', () => {
  it('registers a model init on the link component type', () => {
    const editor = makeEditor();
    registerLinkTraits(editor);
    expect(editor.DomComponents.addType).toHaveBeenCalledWith('link', expect.any(Object));
    expect(typeof editor.types.link.model.init).toBe('function');
  });

  it('init() adds href / target / rel / title / download traits when missing', () => {
    const editor = makeEditor();
    registerLinkTraits(editor);
    const addTrait = vi.fn();
    const component = {
      getTrait: vi.fn(() => null),
      addTrait,
    };
    editor.types.link.model.init.call(component);
    const names = addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(expect.arrayContaining(['href', 'target', 'rel', 'title', 'download']));
  });

  it('component:selected fallback adds traits for <a> tagName not typed as link', () => {
    const editor = makeEditor();
    registerLinkTraits(editor);
    const cb = editor.listeners['component:selected'][0];
    const component = {
      get: (k: string) => (k === 'type' ? 'default' : k === 'tagName' ? 'a' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    cb(component);
    expect(component.addTrait).toHaveBeenCalled();
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(expect.arrayContaining(['href', 'target']));
  });
});
