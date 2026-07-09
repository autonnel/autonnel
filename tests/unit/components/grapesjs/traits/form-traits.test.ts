import { describe, it, expect, vi } from 'vitest';
import { registerFormTraits } from '@/components/grapesjs/traits/form-traits';

function setup() {
  const listeners: Record<string, Function[]> = {};
  const editor = {
    on: vi.fn((e: string, fn: Function) => { (listeners[e] ||= []).push(fn); }),
  } as any;
  registerFormTraits(editor);
  return {
    editor,
    select(tagName: string) {
      const component = {
        get: (k: string) => (k === 'tagName' ? tagName : undefined),
        getTrait: vi.fn(() => null),
        addTrait: vi.fn(),
        trigger: vi.fn(),
      };
      listeners['component:selected'][0](component);
      return component.addTrait.mock.calls.map((c) => c[0].name);
    },
  };
}

describe('registerFormTraits', () => {
  it('form: action/method/enctype/target/name', () => {
    const { select } = setup();
    expect(select('form')).toEqual(
      expect.arrayContaining(['action', 'method', 'enctype', 'target', 'name']),
    );
  });

  it('input: type/name/placeholder/value/required/min/max/pattern/autocomplete', () => {
    const { select } = setup();
    expect(select('input')).toEqual(
      expect.arrayContaining([
        'type', 'name', 'placeholder', 'value', 'required', 'min', 'max', 'pattern', 'autocomplete',
      ]),
    );
  });

  it('button: type/name/value/disabled', () => {
    const { select } = setup();
    expect(select('button')).toEqual(
      expect.arrayContaining(['type', 'name', 'value', 'disabled']),
    );
  });

  it('textarea: name/placeholder/rows/cols/required/maxlength', () => {
    const { select } = setup();
    expect(select('textarea')).toEqual(
      expect.arrayContaining(['name', 'placeholder', 'rows', 'cols', 'required', 'maxlength']),
    );
  });

  it('select: name/required/multiple/size', () => {
    const { select } = setup();
    expect(select('select')).toEqual(
      expect.arrayContaining(['name', 'required', 'multiple', 'size']),
    );
  });

  it('div: no traits added', () => {
    const { select } = setup();
    expect(select('div')).toEqual([]);
  });
});
