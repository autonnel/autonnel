import { describe, it, expect, vi } from 'vitest';
import { registerIdentityTraits } from '@/components/grapesjs/traits/identity-traits';

describe('registerIdentityTraits', () => {
  it('adds id and class traits to every selected component (low priority — appended last)', () => {
    const listeners: Record<string, Function[]> = {};
    const editor = {
      on: vi.fn((e: string, fn: Function) => { (listeners[e] ||= []).push(fn); }),
    } as any;
    registerIdentityTraits(editor);
    const component = {
      get: (k: string) => (k === 'tagName' ? 'div' : undefined),
      getTrait: vi.fn(() => null),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    listeners['component:selected'][0](component);
    const names = component.addTrait.mock.calls.map((c) => c[0].name);
    expect(names).toEqual(['id', 'class']);
  });

  it('does not duplicate when already present', () => {
    const listeners: Record<string, Function[]> = {};
    const editor = {
      on: vi.fn((e: string, fn: Function) => { (listeners[e] ||= []).push(fn); }),
    } as any;
    registerIdentityTraits(editor);
    const component = {
      get: () => 'div',
      getTrait: vi.fn(() => ({ name: 'id' })),
      addTrait: vi.fn(),
      trigger: vi.fn(),
    };
    listeners['component:selected'][0](component);
    expect(component.addTrait).not.toHaveBeenCalled();
  });
});
