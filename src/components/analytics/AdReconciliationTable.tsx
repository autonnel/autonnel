import * as React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../primitives/ds';
import { DiffCell, ConflictTooltip, formatCount, formatMoney, formatRoas, nullableCount } from './ad-diff-cells';
import type { ReconciliationRowVM } from '@/lib/dashboard/ads-reconciliation-data';
import { timezoneDisplay } from '@/lib/constants/timezone';

export interface AdReconciliationTableProps {
  rows: ReconciliationRowVM[];
  currency: string;
}

function rowKey(row: ReconciliationRowVM, index: number): string {
  return `${row.funnelId}::${row.platform}::${row.accountLabel}::${index}`;
}

const COLUMN_COUNT = 10;

// Ad set, not just campaign: one creative duplicated into two ad sets is two ads with the same
// name, and the campaign is identical on both, so without the ad set the two rows look like a
// rendering bug rather than two real ads.
function creativeSubtitle(c: { campaignName: string | null; adsetName: string | null }): string {
  return [c.campaignName, c.adsetName].filter(Boolean).join(' / ') || '-';
}

function CreativeDetailRows({ row, currency }: { row: ReconciliationRowVM; currency: string }) {
  if (row.creatives.length === 0) {
    return (
      <tr>
        <td colSpan={COLUMN_COUNT} className="px-4 py-3 text-[12.5px] text-ds-muted bg-ds-surface2">
          No creative-level detail for this funnel and currency in this range.
        </td>
      </tr>
    );
  }
  return (
    <>
      {row.creatives.map((c) => (
        <tr key={c.creativeId} className="bg-ds-surface2">
          <td className="px-4 py-2 text-[12.5px] text-ds-ink" colSpan={2}>
            <div className="font-medium">{c.name}</div>
            <div className="text-[11px] text-ds-faint truncate">{creativeSubtitle(c)}</div>
          </td>
          <td className="px-4 py-2 text-[12px] text-ds-muted truncate max-w-[220px]">{c.destinationUrl ?? '-'}</td>
          <td className="px-4 py-2 text-[12.5px] text-ds-ink text-right font-ds-mono tabular">
            {formatMoney(c.spendMinor, currency)}
          </td>
          <td className="px-4 py-2 text-[12.5px] text-ds-ink text-right font-ds-mono tabular">{formatCount(c.impressions)}</td>
          <td className="px-4 py-2 text-[12.5px] text-ds-ink text-right font-ds-mono tabular">
            {formatCount(c.linkClicks ?? c.clicks)}
          </td>
          <td className="px-4 py-2 text-[12.5px] text-ds-ink text-right font-ds-mono tabular">{nullableCount(c.initiateCheckout)}</td>
          <td className="px-4 py-2 text-[12.5px] text-ds-ink text-right font-ds-mono tabular">{formatCount(c.conversions)}</td>
          <td />
          <td />
        </tr>
      ))}
    </>
  );
}

export default function AdReconciliationTable({ rows, currency }: AdReconciliationTableProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (rows.length === 0) {
    return <div className="px-6 py-8 text-center text-[13px] text-ds-muted">No attributed ad spend in {currency} for this range.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Funnel</Th>
            <Th>Platform</Th>
            <Th>Account</Th>
            <Th align="right">Spend</Th>
            <Th align="right">Impr</Th>
            <Th align="right">Link clicks</Th>
            <Th align="right">Checkout init</Th>
            <Th align="right">Conversions</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">ROAS</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row, i) => {
            const key = rowKey(row, i);
            const isExpanded = expanded.has(key);
            const zoneMismatch = !row.timezoneAligned;
            return (
              <React.Fragment key={key}>
                <Tr className="cursor-pointer" onClick={() => toggle(key)}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ds-faint text-[11px] w-3 inline-block">{isExpanded ? '▾' : '▸'}</span>
                      <span className="font-medium">{row.funnelName}</span>
                      {row.reasons.length > 0 && (
                        <ConflictTooltip reasons={row.reasons}>
                          <Badge tone="warn">{row.reasons.length}</Badge>
                        </ConflictTooltip>
                      )}
                    </div>
                  </Td>
                  <Td>{row.platform}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span>{row.accountLabel}</span>
                      {zoneMismatch && (
                        <Badge tone="muted" className="whitespace-nowrap">
                          {timezoneDisplay(row.accountTimezone)}
                        </Badge>
                      )}
                    </div>
                  </Td>
                  <Td align="right" mono>{formatMoney(row.spendMinor, currency)}</Td>
                  <Td align="right" mono>{formatCount(row.impressions)}</Td>
                  <Td align="right">
                    <DiffCell platform={row.linkClicks} onsite={row.onsiteClicks} diff={row.clicksDiff} />
                  </Td>
                  <Td align="right">
                    <DiffCell
                      platform={row.platformCheckoutInit ?? 0}
                      onsite={row.onsiteCheckouts}
                      diff={row.checkoutInitDiff}
                      unavailableNote="This platform does not report a checkout-start metric."
                    />
                  </Td>
                  <Td align="right">
                    <DiffCell platform={row.platformConversions} onsite={row.onsiteOrders} diff={row.conversionsDiff} />
                  </Td>
                  <Td align="right">
                    <DiffCell
                      platform={row.platformRevenueMinor}
                      onsite={row.onsiteRevenueMinor}
                      diff={row.revenueDiff}
                      currency={currency}
                      unavailableNote="This funnel has onsite orders, but none in this ad account's reporting currency for this range."
                    />
                  </Td>
                  <Td align="right" mono>{formatRoas(row.platformRevenueMinor, row.spendMinor)}</Td>
                </Tr>
                {isExpanded && <CreativeDetailRows row={row} currency={currency} />}
              </React.Fragment>
            );
          })}
        </Tbody>
      </Table>
    </div>
  );
}
