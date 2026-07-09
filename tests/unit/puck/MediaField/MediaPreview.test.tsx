import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaPreview } from '@/components/builder/MediaField/MediaPreview';

describe('MediaPreview', () => {
  it('renders an <img> when url is an image', () => {
    const { container } = render(
      <MediaPreview url="https://cdn/x.png" prompt="" mediaType="image" generating={false} generatingType={null} />
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn/x.png');
  });

  it('renders a <video> when url ends in .mp4', () => {
    const { container } = render(
      <MediaPreview url="https://cdn/x.mp4" prompt="" mediaType="video" generating={false} generatingType={null} />
    );
    expect(container.querySelector('video')).not.toBeNull();
  });

  it('renders the prompt placeholder when url is empty and prompt is set, without echoing prompt text', () => {
    render(
      <MediaPreview url="" prompt="a buckwheat pillow on a nightstand" mediaType="image" generating={false} generatingType={null} />
    );
    expect(screen.getByText('Image to generate')).toBeTruthy();
    expect(screen.queryByText(/buckwheat/)).toBeNull();
  });

  it('renders the empty placeholder when url and prompt are both empty', () => {
    render(
      <MediaPreview url="" prompt="" mediaType="image" generating={false} generatingType={null} />
    );
    expect(screen.getByText('No media')).toBeTruthy();
  });

  it('shows the generating overlay when generating is true', () => {
    render(
      <MediaPreview url="" prompt="p" mediaType="image" generating generatingType="image" />
    );
    expect(screen.getByText('Generating image...')).toBeTruthy();
  });

  it('caps preview height at 140px', () => {
    const { container } = render(
      <MediaPreview url="https://cdn/x.png" prompt="" mediaType="image" generating={false} generatingType={null} />
    );
    const box = container.firstChild as HTMLElement;
    expect(box.style.maxHeight).toBe('140px');
  });

  it('renders chip slot children in the bottom-right corner', () => {
    render(
      <MediaPreview
        url=""
        prompt=""
        mediaType="image"
        generating={false}
        generatingType={null}
        chipSlot={<span data-testid="chip-slot">CHIP</span>}
      />
    );
    expect(screen.getByTestId('chip-slot').textContent).toBe('CHIP');
  });
});
