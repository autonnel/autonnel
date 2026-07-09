import { describe, it, expect } from 'vitest';
import {
  appendQueryParamsToPuckCtaLinks,
  resolveFunnelCtaLinksInPuckData,
} from '@/lib/puck/resolve-funnel-cta-links';

describe('resolveFunnelCtaLinksInPuckData', () => {
  it('fills funnel CTA URL fields without mutating the original data', () => {
    const data = {
      content: [
        { props: { href: { type: 'funnel-cta', url: '' } } },
        { props: { href: { type: 'custom', url: '/manual' } } },
      ],
    };

    const resolved = resolveFunnelCtaLinksInPuckData(data, '/n/funnel/next');

    expect(resolved.content[0].props.href.url).toBe('/n/funnel/next');
    expect(resolved.content[1].props.href.url).toBe('/manual');
    expect(data.content[0].props.href.url).toBe('');
  });

  it('keeps the same reference when no CTA URL is available', () => {
    const data = { href: { type: 'funnel-cta', url: '' } };
    expect(resolveFunnelCtaLinksInPuckData(data, '')).toBe(data);
  });
});

describe('appendQueryParamsToPuckCtaLinks', () => {
  it('adds query params only to resolved funnel CTA links', () => {
    const data = {
      primary: { type: 'funnel-cta', url: '/n/funnel/next' },
      secondary: { type: 'funnel-cta', url: '/custom' },
    };

    const resolved = appendQueryParamsToPuckCtaLinks(data, { clickid: 'abc', anid: '123' });

    expect(resolved.primary.url).toBe('/n/funnel/next?clickid=abc&anid=123');
    expect(resolved.secondary.url).toBe('/custom');
  });
});
