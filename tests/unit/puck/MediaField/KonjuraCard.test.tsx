import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KonjuraCard } from '@/components/builder/MediaField/KonjuraCard';

beforeEach(() => {
  vi.stubGlobal('open', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('KonjuraCard', () => {
  it('shows the explore label when prompt is empty', () => {
    render(<KonjuraCard prompt="" referenceImageUrl="" mediaType="image" generating={false} />);
    expect(screen.getByRole('button', { name: /Explore Konjura/i })).toBeTruthy();
  });

  it('shows the try label when only prompt is set', () => {
    render(<KonjuraCard prompt="a cat" referenceImageUrl="" mediaType="image" generating={false} />);
    expect(screen.getByRole('button', { name: /Try this in Konjura/i })).toBeTruthy();
  });

  it('shows the continue label when prompt and reference image are both set', () => {
    render(<KonjuraCard prompt="a cat" referenceImageUrl="https://cdn/x.png" mediaType="image" generating={false} />);
    expect(screen.getByRole('button', { name: /Continue in Konjura/i })).toBeTruthy();
  });

  it('opens the konjura URL in a new tab on click', () => {
    render(<KonjuraCard prompt="a cat" referenceImageUrl="https://cdn/x.png" mediaType="video" generating={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Continue in Konjura/i }));
    expect(window.open).toHaveBeenCalledTimes(1);
    const args = (window.open as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const u = new URL(String(args[0]));
    expect(u.searchParams.get('prompt')).toBe('a cat');
    expect(u.searchParams.get('refImage')).toBe('https://cdn/x.png');
    expect(u.searchParams.get('type')).toBe('video');
    expect(u.searchParams.get('source')).toBe('autonnel');
    expect(args[1]).toBe('_blank');
    expect(args[2]).toBe('noopener,noreferrer');
  });

  it('renders the value props bullet line', () => {
    render(<KonjuraCard prompt="" referenceImageUrl="" mediaType="image" generating={false} />);
    expect(screen.getByText(/Multi-image/)).toBeTruthy();
  });

  it('disables the button while generating', () => {
    render(<KonjuraCard prompt="p" referenceImageUrl="" mediaType="image" generating />);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
