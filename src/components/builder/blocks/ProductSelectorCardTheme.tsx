import React from 'react';
import type { SelectedItem } from './product-selection-types';
import { formatPrice } from './ProductSelectionModal';
import { scaledFontSize } from '../TextField';
import { resolveItemBadge, type BadgeDefaults } from './badge-utils';

export interface CardThemeProps {
  items: SelectedItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currency: string;
  accentColor: string;
  badgeDefaults: BadgeDefaults;
  borderColor: string;
  borderRadius: number;
  perUnitText: string;
  discountBadgeColor: string;
  bottomText: string;
}

const GRID_CLASS = 'old-product-card-grid';
const ITEM_CLASS = 'old-product-card-item';
const NARROW_QUERY = `@container (max-width: 520px){.${GRID_CLASS}{grid-template-columns:1fr !important;}}`;

const MUTED = '#6b7280';
const STRIKE = '#b0b0b0';
const FOOTER_BG = '#f5f5f5';

type Money = {
  unit: number;
  sum: number;
  wasSum: number;
  savedPct: number;
  reduced: boolean;
};

const deriveMoney = (entry: SelectedItem): Money => {
  const units = entry.quantity || 1;
  const prior = entry.comparePrice;
  const reduced = Boolean(prior && prior > entry.price);
  let savedPct = 0;
  if (reduced) {
    savedPct = Math.round((1 - entry.price / prior!) * 100);
  }
  return {
    unit: entry.price / units,
    sum: entry.price,
    wasSum: reduced ? prior! : 0,
    savedPct,
    reduced,
  };
};

const sx = {
  grid: (): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  }),
  shell: (): React.CSSProperties => ({
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  }),
  ribbon: (
    bg: React.CSSProperties['background'],
    fg: React.CSSProperties['color'],
    size: React.CSSProperties['fontSize'],
    radius: number,
  ): React.CSSProperties => ({
    background: bg,
    textAlign: 'center',
    padding: '6px 8px',
    color: fg,
    fontSize: size,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderRadius: `${radius}px ${radius}px 0 0`,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  }),
  frame: (
    ribboned: boolean,
    active: boolean,
    accent: string,
    line: string,
    radius: number,
  ): React.CSSProperties => ({
    borderRadius: ribboned ? `0 0 ${radius}px ${radius}px` : radius,
    overflow: 'hidden',
    border: `2px solid ${active ? accent : line}`,
    background: '#fff',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  }),
  body: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 12px',
    flex: 1,
    position: 'relative',
  } as React.CSSProperties,
  radioOuter: (active: boolean, accent: string): React.CSSProperties => ({
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `2px solid ${active ? accent : '#d1d5db'}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  radioDot: (accent: string): React.CSSProperties => ({
    width: 9,
    height: 9,
    borderRadius: '50%',
    background: accent,
  }),
  media: {
    width: 102,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  thumb: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  } as React.CSSProperties,
  info: { flex: 1, minWidth: 0 } as React.CSSProperties,
  title: {
    fontSize: scaledFontSize(16),
    fontWeight: 700,
    color: '#1a1a1a',
  } as React.CSSProperties,
  variant: {
    fontSize: scaledFontSize(12),
    color: '#9ca3af',
    marginTop: 1,
  } as React.CSSProperties,
  unitPrice: {
    fontSize: scaledFontSize(24),
    fontWeight: 800,
    color: '#111',
    marginTop: 4,
  } as React.CSSProperties,
  note: {
    fontSize: scaledFontSize(12),
    color: MUTED,
    marginTop: 1,
  } as React.CSSProperties,
  saveTag: (bg: string): React.CSSProperties => ({
    display: 'inline-block',
    marginTop: 4,
    padding: '2px 10px',
    borderRadius: 20,
    background: bg,
    color: '#fff',
    fontSize: scaledFontSize(12),
    fontWeight: 700,
  }),
  footer: (line: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '8px 12px',
    background: FOOTER_BG,
    borderTop: `1px solid ${line}`,
    fontSize: scaledFontSize(13),
  }),
  footerLabel: { color: MUTED, fontWeight: 500 } as React.CSSProperties,
  footerWas: {
    color: STRIKE,
    textDecoration: 'line-through',
    fontSize: scaledFontSize(12),
  } as React.CSSProperties,
  footerNow: {
    fontWeight: 800,
    color: STRIKE,
    fontSize: scaledFontSize(13),
  } as React.CSSProperties,
  caption: {
    textAlign: 'center',
    marginTop: 14,
    fontSize: scaledFontSize(13),
    color: MUTED,
    fontWeight: 500,
  } as React.CSSProperties,
};

type CardProps = Omit<CardThemeProps, 'items' | 'selectedId' | 'bottomText'> & {
  item: SelectedItem;
  isSelected: boolean;
};

function ProductCardItem(props: CardProps) {
  const {
    item,
    isSelected,
    onSelect,
    currency,
    accentColor,
    badgeDefaults,
    borderColor,
    borderRadius,
    perUnitText,
    discountBadgeColor,
  } = props;

  const ribbon = resolveItemBadge(item, badgeDefaults);
  const money = deriveMoney(item);

  const footerWas = money.reduced ? (
    <span style={sx.footerWas}>{formatPrice(money.wasSum, currency)}</span>
  ) : null;

  return (
    <div onClick={() => onSelect(item.id)} style={sx.shell()} className={ITEM_CLASS}>
      {ribbon && (
        <div style={sx.ribbon(ribbon.backgroundColor, ribbon.textStyle.color, ribbon.textStyle.fontSize, borderRadius)}>
          {ribbon.label}
        </div>
      )}

      <div style={sx.frame(!!ribbon, isSelected, accentColor, borderColor, borderRadius)}>
        <div style={sx.body}>
          <div style={sx.radioOuter(isSelected, accentColor)}>
            {isSelected && <div style={sx.radioDot(accentColor)} />}
          </div>

          {item.thumbnail && (
            <div style={sx.media}>
              <img src={item.thumbnail} alt={item.productName} style={sx.thumb} />
            </div>
          )}

          <div style={sx.info}>
            <div style={sx.title}>{item.productName}</div>
            {item.variantName && <div style={sx.variant}>{item.variantName}</div>}
            <div style={sx.unitPrice}>{formatPrice(money.unit, currency)}</div>
            {perUnitText && <div style={sx.note}>{perUnitText}</div>}
            {money.savedPct > 0 && (
              <span style={sx.saveTag(discountBadgeColor)}>{money.savedPct}% OFF</span>
            )}
          </div>
        </div>

        <div style={sx.footer(borderColor)}>
          <span style={sx.footerLabel}>Total Price:</span>
          {footerWas}
          <span style={sx.footerNow}>{formatPrice(money.sum, currency)}</span>
        </div>
      </div>
    </div>
  );
}

export function ProductSelectorCardTheme(props: CardThemeProps) {
  const { items, selectedId, bottomText } = props;
  const gridStyle =
    items.length === 1 ? { ...sx.grid(), gridTemplateColumns: '1fr' } : sx.grid();

  return (
    <div style={{ containerType: 'inline-size' } as React.CSSProperties}>
      <div className={GRID_CLASS} style={gridStyle}>
        {items.map((entry) => (
          <ProductCardItem
            key={entry.id}
            item={entry}
            isSelected={entry.id === selectedId}
            onSelect={props.onSelect}
            currency={props.currency}
            accentColor={props.accentColor}
            badgeDefaults={props.badgeDefaults}
            borderColor={props.borderColor}
            borderRadius={props.borderRadius}
            perUnitText={props.perUnitText}
            discountBadgeColor={props.discountBadgeColor}
          />
        ))}
      </div>

      {bottomText && <div style={sx.caption}>{bottomText}</div>}

      <style>{NARROW_QUERY}</style>
    </div>
  );
}

export default ProductSelectorCardTheme;
