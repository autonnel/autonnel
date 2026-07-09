import { describe, it, expect } from 'vitest';

import { CountdownTimerConfig } from '@/components/builder/blocks/CountdownTimer';
import { PayPalExpressButtonConfig } from '@/components/builder/blocks/PayPalExpressButton';
import { ReviewListConfig } from '@/components/builder/blocks/ReviewList';
import { RichTextBlockConfig } from '@/components/builder/blocks/RichTextBlock';
import { CallToActionBannerConfig } from '@/components/builder/blocks/CallToActionBanner';
import { PageFooterConfig } from '@/components/builder/blocks/PageFooter';

const themeValues = (cfg: any): string[] =>
  (cfg.fields.theme?.options ?? []).map((o: any) => o.value);

describe('CountdownTimerConfig', () => {
  it('declares a radio theme field with block + mini options', () => {
    expect((CountdownTimerConfig.fields.theme as any).type).toBe('radio');
    expect(themeValues(CountdownTimerConfig)).toEqual(expect.arrayContaining(['block', 'mini']));
  });

  it('defaults to the block theme', () => {
    expect(CountdownTimerConfig.defaultProps.theme).toBe('block');
  });
});

describe('PayPalExpressButtonConfig', () => {
  it('declares a radio theme field with badges + cards options', () => {
    expect((PayPalExpressButtonConfig.fields.theme as any).type).toBe('radio');
    expect(themeValues(PayPalExpressButtonConfig)).toEqual(expect.arrayContaining(['badges', 'cards']));
  });

  it('keeps buttonStyle as a select with the 5 known options', () => {
    expect((PayPalExpressButtonConfig.fields.buttonStyle as any).type).toBe('select');
    const vals = (PayPalExpressButtonConfig.fields.buttonStyle as any).options.map((o: any) => o.value);
    expect(vals).toEqual(expect.arrayContaining(['gold', 'blue', 'silver', 'white', 'black']));
  });

  it('does not carry dead showApplePay / showGooglePay fields', () => {
    expect((PayPalExpressButtonConfig.fields as any).showApplePay).toBeUndefined();
    expect((PayPalExpressButtonConfig.fields as any).showGooglePay).toBeUndefined();
  });

  it('defaults to the badges theme', () => {
    expect(PayPalExpressButtonConfig.defaultProps.theme).toBe('badges');
  });
});

describe('ReviewListConfig', () => {
  it('declares a radio theme field with list + hero + carousel options', () => {
    expect((ReviewListConfig.fields.theme as any).type).toBe('radio');
    expect(themeValues(ReviewListConfig)).toEqual(expect.arrayContaining(['list', 'hero', 'carousel']));
  });

  it('exposes both data fields (reviews + images)', () => {
    expect(ReviewListConfig.fields.reviews).toBeDefined();
    expect(ReviewListConfig.fields.images).toBeDefined();
  });

  it('defaults to the list theme', () => {
    expect(ReviewListConfig.defaultProps.theme).toBe('list');
  });
});

describe('RichTextBlockConfig', () => {
  it('uses Puck native richtext for the content field', () => {
    expect((RichTextBlockConfig.fields.content as any).type).toBe('richtext');
  });

  it('preserves the wrapper fields title and lastUpdated', () => {
    expect(RichTextBlockConfig.fields.title).toBeDefined();
    expect(RichTextBlockConfig.fields.lastUpdated).toBeDefined();
  });
});

describe('CallToActionBannerConfig', () => {
  it('declares a radio theme field with plain + sale-card options', () => {
    expect((CallToActionBannerConfig.fields.theme as any).type).toBe('radio');
    expect(themeValues(CallToActionBannerConfig)).toEqual(expect.arrayContaining(['plain', 'sale-card']));
  });

  it('defaults to the plain theme', () => {
    expect(CallToActionBannerConfig.defaultProps.theme).toBe('plain');
  });
});

describe('PageFooterConfig', () => {
  it('declares a radio theme field with full + compact options', () => {
    expect((PageFooterConfig.fields.theme as any).type).toBe('radio');
    expect(themeValues(PageFooterConfig)).toEqual(expect.arrayContaining(['full', 'compact']));
  });

  it('defaults to the full theme', () => {
    expect(PageFooterConfig.defaultProps.theme).toBe('full');
  });
});
