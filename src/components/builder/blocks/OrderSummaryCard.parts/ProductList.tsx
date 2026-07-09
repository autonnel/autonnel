import React from 'react';
import { scaledFontSize } from '../../TextField';
import { formatPrice } from '../ProductSelectionModal';
import { PALETTE, type MoneyContext, type SelectedProduct, type Translate } from './types';

const lineRowStyle = (showDivider: boolean, borderColor: string): React.CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 0',
  borderBottom: showDivider ? `1px solid ${borderColor}` : 'none',
});

const thumbStyle = (borderColor: string): React.CSSProperties => ({
  width: 56,
  height: 56,
  borderRadius: 8,
  objectFit: 'cover',
  border: `1px solid ${borderColor}`,
  flexShrink: 0,
});

const lineNameStyle = (color: string): React.CSSProperties => ({
  fontSize: scaledFontSize(14),
  fontWeight: 500,
  color,
  marginBottom: 2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

function ProductLine({
  product,
  index,
  lastIndex,
  money,
  t,
}: {
  product: SelectedProduct;
  index: number;
  lastIndex: number;
  money: MoneyContext;
  t: Translate;
}) {
  const heading = product.productName || product.name;
  const isFree = product.price <= 0;
  const inkColor = money.textColor ?? PALETTE.ink;
  const mutedColor = money.mutedColor ?? PALETTE.slate;
  const freeColor = money.successColor ?? PALETTE.green;

  return (
    <div style={lineRowStyle(index < lastIndex, money.borderColor)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        {product.thumbnail ? (
          <img src={product.thumbnail} alt={heading} style={thumbStyle(money.borderColor)} />
        ) : null}
        <div style={{ minWidth: 0 }}>
          <p style={lineNameStyle(inkColor)}>{heading}</p>
          {product.quantity > 1 ? (
            <p style={{ fontSize: scaledFontSize(13), color: mutedColor }}>
              {t('orderSummary.qty')} {product.quantity} ×{' '}
              {formatPrice(product.price / product.quantity, money.currency)}
            </p>
          ) : null}
        </div>
      </div>
      <span
        style={{
          fontSize: scaledFontSize(15),
          fontWeight: 600,
          color: isFree ? freeColor : inkColor,
          flexShrink: 0,
          marginLeft: 12,
        }}
      >
        {isFree ? 'FREE' : formatPrice(product.price, money.currency)}
      </span>
    </div>
  );
}

export function ProductList({
  products,
  money,
  t,
}: {
  products: SelectedProduct[];
  money: MoneyContext;
  t: Translate;
}) {
  if (products.length === 0) {
    return (
      <div
        style={{
          padding: '16px 0',
          textAlign: 'center',
          color: money.mutedColor ?? PALETTE.faint,
          fontSize: scaledFontSize(14),
        }}
      >
        {t('orderSummary.emptyState')}
      </div>
    );
  }

  const tail = products.length - 1;
  return (
    <>
      {products.map((product, index) => (
        <ProductLine
          key={product.productId}
          product={product}
          index={index}
          lastIndex={tail}
          money={money}
          t={t}
        />
      ))}
    </>
  );
}
