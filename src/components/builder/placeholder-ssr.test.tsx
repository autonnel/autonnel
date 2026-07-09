import { describe, expect, it } from 'vitest';
import type { Data } from '@puckeditor/core';
import { renderPuckToHtml } from '@/lib/puck-ssr';

function pageWithImage(image: unknown): Data {
  return {
    content: [{ type: 'ImageBlock', props: { id: 'img-1', image, alt: 'hero' } }],
    root: { props: {} },
  } as unknown as Data;
}

describe('published storefront SSR (real Puck <Render>)', () => {
  it('does not leak the prompt-only placeholder onto the live page', () => {
    const html = renderPuckToHtml(pageWithImage({ url: '', prompt: 'a cat', mediaType: 'image' }));
    expect(html).not.toContain('data:image/svg+xml');
  });

  it('renders a generated image url on the live page', () => {
    const html = renderPuckToHtml(pageWithImage({ url: 'https://cdn.example/x.jpg', prompt: 'a cat', mediaType: 'image' }));
    expect(html).toContain('https://cdn.example/x.jpg');
  });
});
