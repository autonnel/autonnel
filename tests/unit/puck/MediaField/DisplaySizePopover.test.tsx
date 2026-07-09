import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplaySizePopover } from '@/components/builder/MediaField/DisplaySizePopover';
import type { MediaFieldValue } from '@/components/builder/MediaField';

const baseValue: MediaFieldValue = { url: '', prompt: '', mediaType: 'image' };

describe('DisplaySizePopover', () => {
  it('renders Auto label when no display size is set', () => {
    render(<DisplaySizePopover value={baseValue} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Auto/ })).toBeTruthy();
  });

  it('renders the ratio in the chip label when set', () => {
    render(<DisplaySizePopover value={{ ...baseValue, displaySizeMode: 'ratio', displayRatio: '16:9' }} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /16:9/ })).toBeTruthy();
  });

  it('renders the custom WxH in the chip label when set', () => {
    render(<DisplaySizePopover value={{ ...baseValue, displaySizeMode: 'custom', displayWidth: 300, displayHeight: 200 }} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /300×200/ })).toBeTruthy();
  });

  it('opens the panel on chip click and closes on Esc', () => {
    render(<DisplaySizePopover value={baseValue} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Original')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Original')).toBeNull();
  });

  it('closes on outside click', () => {
    render(
      <div>
        <DisplaySizePopover value={baseValue} onChange={() => {}} />
        <button data-testid="outside">outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Auto/ }));
    expect(screen.getByText('Original')).toBeTruthy();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Original')).toBeNull();
  });

  it('propagates change events from the panel', () => {
    const onChange = vi.fn();
    render(<DisplaySizePopover value={baseValue} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Auto/ }));
    fireEvent.click(screen.getByText('Ratio'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ displaySizeMode: 'ratio' }));
  });
});
