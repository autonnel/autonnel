import { describe, expect, it } from 'vitest';
import type { Data } from '@puckeditor/core';
import { renderPuckToHtml, renderPuckToHtmlWithIslands } from '@/lib/puck-ssr';

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

describe('product selector SSR on checkout pages', () => {
  const page = {
    content: [{
      type: 'VariantSelector',
      props: { id: 'vs-1', selectedItems: { currency: 'USD', items: [{ id: 'v1', productId: 'p1', productName: 'Serum', price: 31, quantity: 1 }] } },
    }],
    root: { props: { currency: 'EUR' } },
  } as unknown as Data;

  it('renders the loading state in island markup instead of the stored price', () => {
    const html = renderPuckToHtmlWithIslands(page);
    expect(html).toContain('Loading prices...');
    expect(html).not.toContain('31.00');
  });

  it('keeps the stored price in island markup rendered without live pricing', () => {
    const html = renderPuckToHtmlWithIslands(page, undefined, { livePricing: false });
    expect(html).toContain('31.00');
    expect(html).not.toContain('Loading prices...');
  });

  it('keeps the stored price on statically rendered pages', () => {
    expect(renderPuckToHtml(page)).toContain('31.00');
  });
});
