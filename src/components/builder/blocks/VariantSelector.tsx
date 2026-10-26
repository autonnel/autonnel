import React, { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeSelection, type SelectedItem, type ProductSelectionData } from './product-selection-types';
import { createTextField, type TextFieldValue, scaledFontSize } from '../TextField';
import { useTranslation } from '../LanguageContext';
import { SectionTitle } from '../SectionTitle';
import { ProductSelectorCardTheme } from './ProductSelectorCardTheme';
import { ProductSelectorKitTheme } from './ProductSelectorKitTheme';
import { ProductSelectorField } from './ProductSelectorField';
import { type BadgeDefaults } from './badge-utils';
import { parseVariantIds, pickPreselectedId, VARIANT_QUERY_PARAM } from '@/lib/storefront/variant-params';
import type { PreselectedItems } from '@/lib/storefront/preselected-items';
import { CART_LINE_REJECTED_EVENT, useLiveSelection } from './live-selection';

export interface VariantSelectorProps {
  sectionTitle?: string | TextFieldValue;
  selectedItems?: SelectedItem[] | ProductSelectionData;
  accentColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  theme?: 'card' | 'kit';
  perUnitText?: string;
  discountBadgeColor?: string;
  bottomText?: string;
  kitCardColor?: string;
  kitTextColor?: string;
  kitSubtitleColor?: string;
  kitStrikeColor?: string;
  kitRadioColor?: string;
}

const EMPTY_GLYPH = '\u{1F4E6}';

// Islands are client-rendered (createRoot), so reading window in the initial state is safe.
function preselectedPaidItemId(items: SelectedItem[]): string | null {
  if (typeof window === 'undefined') return null;
  const preselected = (window as { __AUTONNEL_PRESELECTED_ITEMS__?: PreselectedItems | null }).__AUTONNEL_PRESELECTED_ITEMS__;
  const requested = [
    ...(preselected?.items ?? []).map((i) => i.id),
    ...parseVariantIds(new URLSearchParams(window.location.search).get(VARIANT_QUERY_PARAM)),
  ];
  if (requested.length === 0) return null;
  return pickPreselectedId(items.filter((it) => it.price > 0).map((it) => it.id), requested);
}

const wrapStyle = (bg: string, radius: number): React.CSSProperties => ({
  background: bg,
  padding: '16px',
  borderRadius: radius,
  containerType: 'inline-size',
} as React.CSSProperties);

function EmptyPanel({ label, hint }: { label: string; hint?: string }) {
  const shell: React.CSSProperties = {
    border: '2px dashed #e5e7eb',
    borderRadius: 12,
    background: '#f9fafb',
    padding: '32px 16px',
    textAlign: 'center',
  };
  const captions: Array<[string, React.CSSProperties]> = [
    [label, { color: '#6b7280', fontWeight: 500, fontSize: scaledFontSize(16) }],
  ];
  if (hint) captions.push([hint, { color: '#9ca3af', marginTop: 8, fontSize: scaledFontSize(14) }]);
  return (
    <div style={shell}>
      <span style={{ display: 'block', marginBottom: 12, fontSize: scaledFontSize(48) }}>{EMPTY_GLYPH}</span>
      {captions.map(([text, css], i) => (
        <p key={i} style={css}>
          {text}
        </p>
      ))}
    </div>
  );
}

export function VariantSelector({
  sectionTitle = '',
  selectedItems,
  accentColor = '#22c55e',
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 8,
  theme = 'card',
  perUnitText = 'per pack',
  discountBadgeColor = '#dc2626',
  bottomText = '',
  kitCardColor,
  kitTextColor,
  kitSubtitleColor,
  kitStrikeColor,
  kitRadioColor,
}: VariantSelectorProps) {
  const t = useTranslation();
  const selection = normalizeSelection(selectedItems);

  const paymentCurrency =
    typeof window !== 'undefined' && (window as any).__PAYMENT_CONFIG__?.paypal?.currency;
  const pricing = useLiveSelection(selection.items, selection.currency || paymentCurrency || 'USD');
  const [rejectedIds, setRejectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const items = rejectedIds.size ? pricing.items.filter((it) => !rejectedIds.has(it.id)) : pricing.items;
  const [selectedId, setSelectedId] = useState<string | null>(
    () => preselectedPaidItemId(selection.items) ?? selection.items[0]?.id ?? null,
  );
  const userActionRef = useRef(false);

  const freeItems = items.filter((it) => it.price <= 0);
  const paidItems = items.filter((it) => it.price > 0);

  useEffect(() => {
    const firstPaid = selection.items.find((it) => it.price > 0);
    if (firstPaid && !selectedId) {
      setSelectedId(firstPaid.id);
    }
  }, [selectedItems]);

  useEffect(() => {
    if (!pricing.live) return;
    const onRejected = (e: Event) => {
      const variantId = (e as CustomEvent).detail?.variantId;
      if (typeof variantId === 'string') setRejectedIds((prev) => new Set(prev).add(variantId));
    };
    window.addEventListener(CART_LINE_REJECTED_EVENT, onRejected);
    return () => window.removeEventListener(CART_LINE_REJECTED_EVENT, onRejected);
  }, [pricing.live]);

  const currentItem = paidItems.find((it) => it.id === selectedId) || paidItems[0];

  const resolvedCurrency = pricing.currency;
  const itemCurrency = resolvedCurrency;

  const broadcastSelection = useCallback(() => {
    if (!currentItem) return;
    const isUserAction = userActionRef.current;
    userActionRef.current = false;
    window.dispatchEvent(
      new CustomEvent('autonnel:productsSelected', {
        detail: {
          products: [currentItem, ...freeItems],
          total: currentItem.price,
          currency: resolvedCurrency,
          regionId: selection.regionId,
          userInitiated: isUserAction,
        },
      }),
    );
  }, [currentItem, freeItems, resolvedCurrency, selection.regionId]);

  useEffect(() => {
    broadcastSelection();
  }, [broadcastSelection]);

  useEffect(() => {
    const onRequest = () => broadcastSelection();
    window.addEventListener('autonnel:requestProductSelection', onRequest);
    return () => window.removeEventListener('autonnel:requestProductSelection', onRequest);
  }, [broadcastSelection]);

  const pick = (id: string) => {
    userActionRef.current = true;
    setSelectedId(id);
  };

  const badgeDefaults: BadgeDefaults = {
    badgeColor: '#0ea5e9',
    badgeTextContent: 'Most Popular',
    badgeTextStyle: { color: '#ffffff', fontSize: scaledFontSize(12) },
  };

  const hasItems = paidItems.length > 0;

  const shared = {
    items: paidItems,
    selectedId,
    onSelect: pick,
    currency: itemCurrency,
    accentColor,
    badgeDefaults,
    borderColor,
    borderRadius,
  };

  const renderCard = () => (
    <ProductSelectorCardTheme
      {...shared}
      perUnitText={perUnitText}
      discountBadgeColor={discountBadgeColor}
      bottomText={bottomText}
    />
  );

  const renderKit = () => (
    <ProductSelectorKitTheme
      {...shared}
      discountBadgeColor={discountBadgeColor}
      cardBackgroundColor={kitCardColor}
      textColor={kitTextColor}
      subtitleColor={kitSubtitleColor}
      strikeColor={kitStrikeColor}
      radioBorderColor={kitRadioColor}
    />
  );

  const themeRenderers: Record<string, () => React.ReactNode> = {
    card: renderCard,
    kit: renderKit,
  };

  const emptyPanel = pricing.live ? (
    <EmptyPanel label={t(pricing.loading ? 'productSelector.loadingPrices' : 'checkout.productUnavailable')} />
  ) : (
    <EmptyPanel label={t('productSelector.noProducts')} hint={t('productSelector.noProductsHint')} />
  );

  const body: React.ReactNode = !hasItems ? emptyPanel : (
    (themeRenderers[theme] ?? renderCard)()
  );

  return (
    <div style={wrapStyle(backgroundColor, borderRadius)}>
      {sectionTitle && <SectionTitle title={sectionTitle} />}
      {body}
    </div>
  );
}

export const VariantSelectorConfig = {
  label: 'Old Product Selector',
  fields: {
    theme: {
      type: 'select' as const,
      label: 'Theme',
      options: [
        { label: 'Card (Grid + Total)', value: 'card' },
        { label: 'Kit (Radio Tiers)', value: 'kit' },
      ],
    },
    sectionTitle: createTextField({ label: 'Section Title', defaultColor: '#1a1a1a', defaultFontSize: 16 }),
    selectedItems: {
      type: 'custom' as const,
      label: 'Selected Products',
      render: ({ value, onChange }: { value: SelectedItem[] | ProductSelectionData; onChange: (value: ProductSelectionData) => void }) => (
        <ProductSelectorField value={value || { items: [], currency: 'USD' }} onChange={onChange} />
      ),
    },
    accentColor: { type: 'text' as const, label: 'Accent Color' },
    backgroundColor: { type: 'text' as const, label: 'Background Color' },
    borderColor: { type: 'text' as const, label: 'Border Color' },
    borderRadius: { type: 'number' as const, label: 'Border Radius', min: 0, max: 24 },
    perUnitText: { type: 'text' as const, label: 'Per Unit Text (Card theme)', contentEditable: true },
    discountBadgeColor: { type: 'text' as const, label: 'Discount Badge Color (Card theme)' },
    bottomText: { type: 'text' as const, label: 'Bottom Text (Card theme)', contentEditable: true },
    kitCardColor: { type: 'text' as const, label: 'Kit Card Background (Kit theme)' },
    kitTextColor: { type: 'text' as const, label: 'Kit Text Color (Kit theme)' },
    kitSubtitleColor: { type: 'text' as const, label: 'Kit Subtitle Color (Kit theme)' },
    kitStrikeColor: { type: 'text' as const, label: 'Kit Strike Color (Kit theme)' },
    kitRadioColor: { type: 'text' as const, label: 'Kit Radio Border (Kit theme)' },
  },
  defaultProps: {
    theme: 'card',
    sectionTitle: '',
    selectedItems: { items: [], currency: 'USD' },
    accentColor: '#22c55e',
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 8,
    perUnitText: 'per pack',
    discountBadgeColor: '#dc2626',
    bottomText: '',
  },
};

export default VariantSelector;
