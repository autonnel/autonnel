import { describe, it, expect, vi } from 'vitest';
import { registerMediaTraits } from '@/components/grapesjs/traits/media-traits';

function makeEditor() {
  const listeners: Record<string, Function[]> = {};
  return {
    listeners,
    on: vi.fn((event: string, fn: Function) => { (listeners[event] ||= []).push(fn); }),
  } as any;
}

describe('registerMediaTraits', () => {
  it('adds video traits on select for <video> elements', () => {
    const editor = makeEditor();
    registerMediaTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'video' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    editor.listeners['component:selected'][0](component);
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(
      expect.arrayContaining(['src', 'poster', 'controls', 'autoplay', 'loop', 'muted', 'preload']),
    );
  });

  it('adds audio traits for <audio> (no poster)', () => {
    const editor = makeEditor();
    registerMediaTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'audio' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    editor.listeners['component:selected'][0](component);
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(expect.arrayContaining(['src', 'controls', 'autoplay', 'loop', 'muted', 'preload']));
    expect(names).not.toContain('poster');
  });

  it('adds source traits for <source>', () => {
    const editor = makeEditor();
    registerMediaTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'source' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    editor.listeners['component:selected'][0](component);
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(expect.arrayContaining(['src', 'type', 'media']));
  });

  it('ignores unrelated tags', () => {
    const editor = makeEditor();
    registerMediaTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'div' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    editor.listeners['component:selected'][0](component);
    expect(component.addTrait).not.toHaveBeenCalled();
  });
});
