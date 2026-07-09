import { useMemo } from 'react';
import { createTextField, getTextContent, type TextFieldValue } from '../TextField';
import { useTranslation } from '../LanguageContext';
import { SectionTitle, titleIconField, type TitleIconType } from '../SectionTitle';
import { sumPrices, resolveDiscount, type MoneyContext } from './OrderSummaryCard.parts/types';
import {
  useSelectedProducts,
  useCouponState,
  useOrderSummaryEvent,
} from './OrderSummaryCard.parts/hooks';
import { ProductList } from './OrderSummaryCard.parts/ProductList';
import { CouponSection } from './OrderSummaryCard.parts/CouponSection';
import { TotalsBlock, TrustBadges } from './OrderSummaryCard.parts/Totals';

export interface OrderSummaryCardProps {
  title?: string | TextFieldValue;
  titleIcon?: TitleIconType;
  showCouponField?: boolean;
  showTrustBadges?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  textColor?: string;
  mutedColor?: string;
  successColor?: string;
}

export function OrderSummaryCard({
  title = 'Order Summary',
  titleIcon = 'clipboard',
  showCouponField = true,
  showTrustBadges = true,
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 12,
  padding = 24,
  textColor,
  mutedColor,
  successColor,
}: OrderSummaryCardProps) {
  const t = useTranslation();
  const titleText = getTextContent(title);

  const { products, currency } = useSelectedProducts();
  const subtotal = useMemo(() => sumPrices(products), [products]);

  const coupon = useCouponState(subtotal, t);
  const discount = useMemo(
    () => resolveDiscount(coupon.appliedCoupon, subtotal),
    [coupon.appliedCoupon, subtotal],
  );
  const total = subtotal - discount;

  const money = useMemo<MoneyContext>(
    () => ({ currency, borderColor, textColor, mutedColor, successColor }),
    [borderColor, currency, textColor, mutedColor, successColor],
  );

  useOrderSummaryEvent(subtotal, discount, total, coupon.appliedCoupon);

  return (
    <div
      className="autonnel-order-summary"
      style={{
        background: backgroundColor,
        borderRadius,
        padding,
        border: `1px solid ${borderColor}`,
      }}
    >
      {titleText ? <SectionTitle title={title ?? ''} titleIcon={titleIcon} gap={10} /> : null}

      <div style={{ marginBottom: 20 }}>
        <ProductList products={products} money={money} t={t} />
      </div>

      {showCouponField ? (
        <CouponSection
          coupon={coupon.appliedCoupon}
          backgroundColor={backgroundColor}
          borderColor={borderColor}
          code={coupon.couponCode}
          setCode={coupon.setCouponCode}
          error={coupon.couponError}
          applying={coupon.applying}
          onApply={() => coupon.applyCoupon()}
          onRemove={coupon.removeCoupon}
          t={t}
        />
      ) : null}

      <TotalsBlock
        products={products}
        subtotal={subtotal}
        discount={discount}
        total={total}
        money={money}
        t={t}
      />

      {showTrustBadges ? <TrustBadges borderColor={borderColor} mutedColor={mutedColor} t={t} /> : null}
    </div>
  );
}

export const OrderSummaryCardConfig = {
  label: 'Order Summary',
  fields: {
    title: createTextField({ label: 'Section Title', defaultColor: '#111827', defaultFontSize: 18 }),
    titleIcon: titleIconField,
    showCouponField: {
      type: 'radio',
      label: 'Show Coupon Field',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showTrustBadges: {
      type: 'radio',
      label: 'Show Trust Badges',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    backgroundColor: {
      type: 'text',
      label: 'Background Color',
    },
    borderColor: {
      type: 'text',
      label: 'Border Color',
    },
    textColor: { type: 'text', label: 'Text Color' },
    mutedColor: { type: 'text', label: 'Muted Text Color' },
    successColor: { type: 'text', label: 'Success / Free Color' },
    borderRadius: {
      type: 'number',
      label: 'Border Radius',
      min: 0,
      max: 32,
    },
    padding: {
      type: 'number',
      label: 'Padding',
      min: 0,
      max: 64,
    },
  },
  defaultProps: {
    title: { text: 'Order Summary', color: '#111827', fontSize: 18 },
    titleIcon: 'clipboard',
    showCouponField: true,
    showTrustBadges: true,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 24,
  },
  render: OrderSummaryCard,
};

export default OrderSummaryCard;
