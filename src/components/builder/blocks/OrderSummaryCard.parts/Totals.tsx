import { type ReactNode } from 'react';
import { BadgeCheck, LockKeyhole, PackageCheck } from 'lucide-react';
import { scaledFontSize } from '../../TextField';
import { formatPrice } from '../ProductSelectionModal';
import { PALETTE, type MoneyContext, type SelectedProduct, type Translate } from './types';

function SummaryRow({
  label,
  value,
  tone = 'muted',
  strong,
  money,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: 'muted' | 'success' | 'dark';
  strong?: boolean;
  money: MoneyContext;
}) {
  const ink = money.textColor ?? PALETTE.ink;
  const muted = money.mutedColor ?? PALETTE.slate;
  const success = money.successColor ?? PALETTE.green;
  const toneColor = tone === 'success' ? success : tone === 'dark' ? ink : muted;
  const valueWeight = strong ? 700 : tone === 'success' ? 500 : undefined;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
      <span
        style={{
          fontSize: scaledFontSize(strong ? 18 : 14),
          fontWeight: strong ? 600 : undefined,
          color: toneColor,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: scaledFontSize(strong ? 24 : 14),
          fontWeight: valueWeight,
          color: strong ? ink : toneColor,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TotalsBlock({
  products,
  subtotal,
  discount,
  total,
  money,
  t,
}: {
  products: SelectedProduct[];
  subtotal: number;
  discount: number;
  total: number;
  money: MoneyContext;
  t: Translate;
}) {
  const populated = products.length > 0;
  const subtotalText = populated ? formatPrice(subtotal, money.currency) : '--';
  const totalText = populated ? formatPrice(total, money.currency) : '--';

  return (
    <div style={{ paddingTop: 16, borderTop: `1px solid ${money.borderColor}` }}>
      <SummaryRow label={t('orderSummary.subtotal')} value={subtotalText} money={money} />
      {discount > 0 ? (
        <SummaryRow
          label={t('orderSummary.discount')}
          value={`-${formatPrice(discount, money.currency)}`}
          tone="success"
          money={money}
        />
      ) : null}
      <SummaryRow
        label={t('orderSummary.shipping')}
        value={t('orderSummary.freeShipping')}
        tone="success"
        money={money}
      />
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `2px solid ${money.borderColor}` }}>
        <SummaryRow label={t('orderSummary.total')} value={totalText} tone="dark" strong money={money} />
      </div>
    </div>
  );
}

function TrustBadge({ icon, label, color }: { icon: ReactNode; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {icon}
      <span style={{ fontSize: scaledFontSize(12), color }}>{label}</span>
    </div>
  );
}

export function TrustBadges({ borderColor, mutedColor, t }: { borderColor: string; mutedColor?: string; t: Translate }) {
  const iconColor = mutedColor ?? PALETTE.slate;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px 16px',
        marginTop: 20,
        paddingTop: 20,
        borderTop: `1px solid ${borderColor}`,
      }}
    >
      <TrustBadge icon={<LockKeyhole size={16} color={iconColor} />} label={t('orderSummary.secure')} color={iconColor} />
      <TrustBadge
        icon={<PackageCheck size={16} color={iconColor} />}
        label={t('orderSummary.freeShipping')}
        color={iconColor}
      />
      <TrustBadge icon={<BadgeCheck size={16} color={iconColor} />} label={t('orderSummary.moneyBack')} color={iconColor} />
    </div>
  );
}
