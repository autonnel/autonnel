import React from 'react';
import { scaledFontSize } from '../TextField';
import { formatPrice } from './ProductSelectionModal';
import { resolveItemBadge, type BadgeDefaults } from './badge-utils';
import type { SelectedItem } from './product-selection-types';

export interface KitThemeProps {
  items: SelectedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currency: string;
  accentColor: string;
  badgeDefaults: BadgeDefaults;
  borderColor: string;
  borderRadius: number;
  discountBadgeColor?: string;
  columns?: number;
  cardBackgroundColor?: string;
  textColor?: string;
  subtitleColor?: string;
  strikeColor?: string;
  radioBorderColor?: string;
}

function pct(item: SelectedItem): number {
  if (!item.comparePrice || item.comparePrice <= item.price) return 0;
  return Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100);
}

function savingsLine(item: SelectedItem, currency: string): string {
  const parts: string[] = [];
  if (item.quantity > 1) parts.push(`${formatPrice(item.price / item.quantity, currency)}/ea`);
  const off = pct(item);
  if (off > 0) parts.push(`${off}% OFF`);
  return parts.join(' · ');
}

function Radio({ selected, accentColor, radioBorderColor }: { selected: boolean; accentColor: string; radioBorderColor: string }) {
  if (selected) {
    return (
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: accentColor,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
      </span>
    );
  }
  return (
    <span
      style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${radioBorderColor}`, flexShrink: 0, display: 'inline-block' }}
    />
  );
}

function KitCard({
  item,
  selected,
  accentColor,
  badgeDefaults,
  borderColor,
  borderRadius,
  currency,
  discountBadgeColor,
  cardBackgroundColor,
  textColor,
  subtitleColor,
  strikeColor,
  radioBorderColor,
  onPick,
}: {
  item: SelectedItem;
  selected: boolean;
  accentColor: string;
  badgeDefaults: BadgeDefaults;
  borderColor: string;
  borderRadius: number;
  currency: string;
  discountBadgeColor: string;
  cardBackgroundColor: string;
  textColor: string;
  subtitleColor: string;
  strikeColor: string;
  radioBorderColor: string;
  onPick: () => void;
}) {
  const badge = resolveItemBadge(item, badgeDefaults);
  const onSale = !!item.comparePrice && item.comparePrice > item.price;
  const line = savingsLine(item, currency);
  const indent = 24;

  const shell: React.CSSProperties = {
    position: 'relative',
    border: `${selected ? 2 : 1}px solid ${selected ? accentColor : borderColor}`,
    borderRadius,
    background: selected ? `${accentColor}0f` : cardBackgroundColor,
    padding: badge ? '16px 12px 12px' : '12px',
    boxShadow: selected ? `0 6px 16px ${accentColor}26` : 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  };

  return (
    <div onClick={onPick} style={shell} className="kit-card">
      {badge ? (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: '50%',
            transform: 'translateX(-50%)',
            background: badge.backgroundColor,
            color: badge.textStyle.color,
            fontSize: badge.textStyle.fontSize || scaledFontSize(10),
            fontWeight: 800,
            letterSpacing: '0.05em',
            padding: '3px 12px',
            borderRadius: 100,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          {badge.label}
        </div>
      ) : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Radio selected={selected} accentColor={accentColor} radioBorderColor={radioBorderColor} />
        <span style={{ fontWeight: 700, color: textColor, fontSize: scaledFontSize(13) }}>{item.productName}</span>
      </div>

      {item.subtitle ? (
        <div style={{ marginLeft: indent, marginTop: 4, color: subtitleColor, fontSize: scaledFontSize(11) }}>
          {item.subtitle}
        </div>
      ) : null}

      <div style={{ marginLeft: indent, marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontWeight: 800, color: selected ? accentColor : textColor, fontSize: scaledFontSize(selected ? 20 : 18) }}>
          {formatPrice(item.price, currency)}
        </span>
        {onSale ? (
          <span style={{ fontSize: scaledFontSize(11), color: strikeColor, textDecoration: 'line-through' }}>
            {formatPrice(item.comparePrice as number, currency)}
          </span>
        ) : null}
      </div>

      {line ? (
        <div style={{ marginLeft: indent, marginTop: 2, color: discountBadgeColor, fontWeight: 700, fontSize: scaledFontSize(11) }}>
          {line}
        </div>
      ) : null}
    </div>
  );
}

export function ProductSelectorKitTheme({
  items,
  selectedId,
  onSelect,
  currency,
  accentColor,
  badgeDefaults,
  borderColor,
  borderRadius,
  discountBadgeColor = '#9a5436',
  columns = 2,
  cardBackgroundColor = '#ffffff',
  textColor = '#26211c',
  subtitleColor = '#8a7e6e',
  strikeColor = '#b6ab9c',
  radioBorderColor = '#d3c4b2',
}: KitThemeProps) {
  return (
    <div
      className="kit-grid"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 10 }}
    >
      {items.map((item) => (
        <KitCard
          key={item.id}
          item={item}
          selected={item.id === selectedId}
          accentColor={accentColor}
          badgeDefaults={badgeDefaults}
          borderColor={borderColor}
          borderRadius={borderRadius}
          currency={currency}
          discountBadgeColor={discountBadgeColor}
          cardBackgroundColor={cardBackgroundColor}
          textColor={textColor}
          subtitleColor={subtitleColor}
          strikeColor={strikeColor}
          radioBorderColor={radioBorderColor}
          onPick={() => onSelect(item.id)}
        />
      ))}
      <style>{'@container (max-width:430px){.kit-grid{grid-template-columns:1fr !important;}}'}</style>
    </div>
  );
}

export default ProductSelectorKitTheme;
