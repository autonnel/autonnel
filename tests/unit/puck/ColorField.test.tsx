// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPickerComponent } from '@/components/builder/ColorField';

describe('ColorPickerComponent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the label and forwards text input changes', () => {
    const onChange = vi.fn();
    render(<ColorPickerComponent label="Accent" value="#123456" onChange={onChange} />);

    expect(screen.getByText('Accent')).toBeTruthy();
    const input = screen.getByPlaceholderText('#000000') as HTMLInputElement;
    expect(input.value).toBe('#123456');

    fireEvent.change(input, { target: { value: '#abcdef' } });
    expect(onChange).toHaveBeenCalledWith('#abcdef');
  });

  it('selects preset colors from the dropdown', () => {
    const onChange = vi.fn();
    render(<ColorPickerComponent value="#123456" onChange={onChange} />);

    fireEvent.click(screen.getByTitle('Open color picker'));
    fireEvent.click(screen.getByTitle('#ef4444'));

    expect(onChange).toHaveBeenCalledWith('#ef4444');
    expect(screen.queryByText('Presets')).toBeNull();
  });

  it('stores valid blurred colors as recent colors', () => {
    render(<ColorPickerComponent value="#123456" onChange={() => {}} />);

    const input = screen.getByPlaceholderText('#000000');
    fireEvent.change(input, { target: { value: '#fedcba' } });
    fireEvent.blur(input);
    fireEvent.click(screen.getByTitle('Open color picker'));

    expect(screen.getByText('Recent')).toBeTruthy();
    expect(screen.getByTitle('#fedcba')).toBeTruthy();
  });
});
