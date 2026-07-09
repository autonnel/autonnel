import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Config, Data } from '@puckeditor/core';
import { renderPuckToHtml, renderPuckToHtmlWithIslands } from '@/lib/puck-ssr';
import { puckConfig } from './config';
import { applyPuckDefaults } from '@/lib/puck/apply-default-props';
import { hasText } from './TextField';
import { CheckoutHeader } from './blocks/CheckoutHeader';
import { CallToActionBanner } from './blocks/CallToActionBanner';

// In the editor the inline-edit transform replaces a TextFieldValue's string `.text` with
// <InlineEditableSpan text={original} />. hasText() must read the wrapped string: filled text
// stays visible while editing (CheckoutHeader brandName), but an emptied field still hides
// hasText-gated elements (a CTA button) — matching the live page.
function inlineEditable(text: string, rest: Partial<{ color: string; fontSize: number }> = {}) {
  return {
    text: createElement('span', { text }, text),
    color: rest.color ?? '#ffffff',
    fontSize: rest.fontSize ?? 16,
  };
}

describe('inline-editable text visibility (editor parity)', () => {
  it('hasText reads the string wrapped by the inline-edit element', () => {
    expect(hasText(inlineEditable('Buy Now') as never)).toBe(true);
    expect(hasText(inlineEditable('') as never)).toBe(false);
    expect(hasText(inlineEditable('   ') as never)).toBe(false);
  });

  it('CheckoutHeader keeps a filled brandName when the editor swapped .text for an element', () => {
    const html = renderToStaticMarkup(
      createElement(CheckoutHeader, {
        brandName: inlineEditable('VibeGorge®', { fontSize: 36 }),
        puck: { isEditing: true },
      } as never),
    );
    expect(html).toContain('VibeGorge®');
  });

  it('CTA Banner hides the button when Button Text is emptied while editing', () => {
    const filled = renderToStaticMarkup(
      createElement(CallToActionBanner, {
        theme: 'plain',
        ctaText: inlineEditable('GET YOURS'),
        puck: { isEditing: true },
      } as never),
    );
    expect(filled).toContain('GET YOURS');
    expect(filled).toContain('padding:16px 40px');

    const emptied = renderToStaticMarkup(
      createElement(CallToActionBanner, {
        theme: 'plain',
        ctaText: inlineEditable(''),
        puck: { isEditing: true },
      } as never),
    );
    expect(emptied).not.toContain('padding:16px 40px');
  });
});

function pageWith(type: string, props: Record<string, unknown> = {}): Data {
  return {
    content: [{ type, props: { id: `${type}-1`, ...props } }],
    root: { props: {} },
  } as unknown as Data;
}

// The data-layer merge is what makes editor == preview == live regardless of which Puck
// <Render> variant merges defaultProps. Keep it pure-tested as the primary contract.
describe('applyPuckDefaults back-fills component defaultProps at the data layer', () => {
  it('fills absent props from defaultProps but never overrides saved values', () => {
    const merged = applyPuckDefaults(
      pageWith('CountdownTimer', { hours: 9 }),
      puckConfig as Config,
    );
    const props = (merged as any).content[0].props;
    expect(props.hours).toBe(9); // saved value wins
    expect(props.minutes).toBe(47); // absent -> default
    expect(props.theme).toBe('block'); // absent -> default
  });

  it('merges root defaultProps', () => {
    const merged = applyPuckDefaults(
      { content: [], root: { props: {} } } as unknown as Data,
      puckConfig as Config,
    );
    expect((merged as any).root.props.maxWidth).toBe('none');
  });
});

// The editor canvas, the preview tab, and the published page now all render through
// Puck's own renderer, so a component prop left unset in the saved data must resolve to
// its defaultProps everywhere. These lock that contract against a regression back to a
// hand-rolled renderer that skips the defaultProps merge.
describe('published render applies Puck defaultProps (preview == live == editor)', () => {
  it('shows a default prop value when the prop is absent from saved data', () => {
    const html = renderPuckToHtml(pageWith('NoticeBar'));
    expect(html).toContain('Free Shipping on Orders Over $50');
  });

  it('keeps an explicit prop over the default', () => {
    const html = renderPuckToHtml(
      pageWith('CallToActionBanner', {
        headline: { text: 'Custom Hook Line', color: '#000000', fontSize: 40 },
      }),
    );
    expect(html).toContain('Custom Hook Line');
    expect(html).not.toContain('Limited-Time Offer - Secure Yours Today');
  });
});

// Interactive components are SSR'd then re-mounted on the client from a serialized props
// script (puck-ssr islandRenderer -> IslandHydrator). This guards that contract: the island
// wrapper is emitted and the JSON props carry Puck-merged defaults across the round-trip.
describe('interactive island round-trip (puck-ssr -> IslandHydrator contract)', () => {
  function extractIslandProps(html: string, type: string): Record<string, unknown> {
    const re = new RegExp(
      `data-island="${type}"[\\s\\S]*?data-island-props[^>]*>([\\s\\S]*?)<\\/script>`,
    );
    const match = html.match(re);
    if (!match) throw new Error(`island "${type}" or its props script not found`);
    return JSON.parse(match[1]) as Record<string, unknown>;
  }

  it('emits an island wrapper carrying default-merged scalar props', () => {
    const html = renderPuckToHtmlWithIslands(pageWith('CountdownTimer'));
    expect(html).toContain('data-island="CountdownTimer"');

    const props = extractIslandProps(html, 'CountdownTimer');
    expect(props.hours).toBe(2);
    expect(props.minutes).toBe(47);
    expect(props.theme).toBe('block');
  });
});
