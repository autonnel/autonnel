import { describe, it, expect, vi } from 'vitest';
import { registerIframeTraits } from '@/components/grapesjs/traits/iframe-traits';

describe('registerIframeTraits', () => {
  it('adds iframe traits on select', () => {
    const listeners: Record<string, Function[]> = {};
    const editor = {
      on: vi.fn((e: string, fn: Function) => { (listeners[e] ||= []).push(fn); }),
    } as any;
    registerIframeTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'iframe' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    listeners['component:selected'][0](component);
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(
      expect.arrayContaining(['src', 'title', 'sandbox', 'allow', 'loading', 'referrerpolicy']),
    );
  });
});
