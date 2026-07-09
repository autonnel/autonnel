import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ImageBlock } from './blocks/ImageBlock';
import { MediaPreview } from './MediaField/MediaPreview';
import { MEDIA_PLACEHOLDER_DATA_URL, placeholderUrl } from './media-placeholder';

afterEach(cleanup);

const promptOnly = { url: '', prompt: 'a cat', mediaType: 'image' as const };
const withUrl = { url: 'https://cdn.example/x.jpg', prompt: '', mediaType: 'image' as const };

describe('placeholderUrl', () => {
  it('returns the placeholder only when a prompt exists AND in editing mode', () => {
    expect(placeholderUrl('a cat', { isEditing: true })).toBe(MEDIA_PLACEHOLDER_DATA_URL);
    expect(placeholderUrl('a cat', { isEditing: false })).toBe('');
    expect(placeholderUrl('a cat', undefined)).toBe('');
    expect(placeholderUrl('', { isEditing: true })).toBe('');
    expect(placeholderUrl(undefined, { isEditing: true })).toBe('');
  });
});

describe('ImageBlock prompt-only rendering across contexts', () => {
  it('live storefront (no puck injected) does not leak the placeholder', () => {
    const html = renderToStaticMarkup(<ImageBlock image={promptOnly} />);
    expect(html).not.toContain('data:image/svg+xml');
    expect(html).toContain('Upload an image');
  });

  it('live storefront (Puck Render injects isEditing=false) does not leak the placeholder', () => {
    const html = renderToStaticMarkup(<ImageBlock image={promptOnly} puck={{ isEditing: false }} />);
    expect(html).not.toContain('data:image/svg+xml');
  });

  it('editor canvas (isEditing=true) still shows the placeholder', () => {
    const html = renderToStaticMarkup(<ImageBlock image={promptOnly} puck={{ isEditing: true }} />);
    expect(html).toContain('data:image/svg+xml');
  });

  it('a real url renders the image regardless of edit mode', () => {
    expect(renderToStaticMarkup(<ImageBlock image={withUrl} puck={{ isEditing: false }} />)).toContain(withUrl.url);
    expect(renderToStaticMarkup(<ImageBlock image={withUrl} puck={{ isEditing: true }} />)).toContain(withUrl.url);
  });
});

describe('MediaField preview affordance', () => {
  it('prompt-only state offers a clear-prompt action and explains it is editor-only', () => {
    const onClearPrompt = vi.fn();
    render(
      <MediaPreview
        url=""
        prompt="a cat"
        mediaType="image"
        generating={false}
        generatingType={null}
        onClearPrompt={onClearPrompt}
      />,
    );
    expect(screen.getByText(/Editor preview only/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear prompt to leave empty/i }));
    expect(onClearPrompt).toHaveBeenCalledTimes(1);
  });

  it('empty state shows No media and no clear action', () => {
    render(
      <MediaPreview url="" prompt="" mediaType="image" generating={false} generatingType={null} />,
    );
    expect(screen.getByText(/No media/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Clear prompt/i })).toBeNull();
  });
});
