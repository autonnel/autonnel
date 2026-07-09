// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DisplaySizeControls, getMediaDisplayStyle } from '@/components/builder/DisplaySizeControls';
import type { MediaFieldValue } from '@/components/builder/MediaField';

const baseValue: MediaFieldValue = { url: 'https://cdn.example/p.png', prompt: '', mediaType: 'image' };

describe('getMediaDisplayStyle', () => {
  it('returns aspect ratio styles for ratio mode', () => {
    expect(getMediaDisplayStyle({ ...baseValue, displaySizeMode: 'ratio', displayRatio: '16:9' })).toEqual({
      width: '100%',
      height: 'auto',
      aspectRatio: '16/9',
      objectFit: 'cover',
    });
  });

  it('returns pixel dimensions for custom mode', () => {
    expect(getMediaDisplayStyle({ ...baseValue, displaySizeMode: 'custom', displayWidth: 320 })).toEqual({
      width: '320px',
      height: 'auto',
      objectFit: 'cover',
    });
  });
});

describe('DisplaySizeControls', () => {
  it('expands the panel and selects ratio mode', () => {
    const onChange = vi.fn();
    render(<DisplaySizeControls value={baseValue} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Display Size/ }));
    fireEvent.click(screen.getByText('Ratio'));

    expect(onChange).toHaveBeenCalledWith({
      ...baseValue,
      displaySizeMode: 'ratio',
      displayRatio: '1:1',
    });
  });
});
