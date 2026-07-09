// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MonacoField } from '@/components/grapesjs/MonacoField';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, language }: any) => (
    <textarea
      data-testid="monaco-mock"
      data-language={language}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

describe('MonacoField', () => {
  it('renders Monaco with given language and value', () => {
    const { getByTestId } = render(
      <MonacoField language="html" value="<p>hi</p>" onChange={() => {}} />,
    );
    const el = getByTestId('monaco-mock') as HTMLTextAreaElement;
    expect(el.getAttribute('data-language')).toBe('html');
    expect(el.value).toBe('<p>hi</p>');
  });

  it('propagates onChange', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      <MonacoField language="css" value="" onChange={onChange} />,
    );
    fireEvent.change(getByTestId('monaco-mock'), { target: { value: 'body{}' } });
    expect(onChange).toHaveBeenCalledWith('body{}');
  });
});
