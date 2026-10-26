import * as React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../primitives/ds';
import { DiffCell, ConflictTooltip, formatCount, formatMoney, formatRoas } from './ad-diff-cells';
import type { ReconciliationRowVM } from '@/lib/dashboard/ads-reconciliation-data';
import { timezoneDisplay } from '@/lib/constants/timezone';

export interface FunnelAdPerformancePanelProps {
  rows: ReconciliationRowVM[];
  currency: string;
  unattributedHref: string;
}

// Rows are already filtered to a single funnel by loadAdReconciliation's funnelId option, so
// (platform, account) is the natural key here -- unlike the global table, there is no funnelId to
// disambiguate.
function rowKey(row: ReconciliationRowVM, index: number): string {
  return `${row.platform}::${row.accountLabel}::${index}`;
}

// A funnel with no ad rows for this currency must render nothing -- a table with zeroed columns
// would read as "this funnel got no clicks", which is a different and false claim from "no ad
// platform data exists for it".
export default function FunnelAdPerformancePanel({ rows, currency, unattributedHref }: FunnelAdPerformancePanelProps) {
  if (rows.length === 0) return null;

  return (
    <div className="bg-ds-card border border-ds-line rounded-[10px] shadow-[0_1px_2px_rgba(17,24,39,.04)]">
      <div className="px-6 pt-5 pb-4">
        <div className="text-[14px] font-semibold text-ds-ink">Ad performance &middot; {currency}</div>
        <div className="text-[12.5px] text-ds-muted mt-0.5">Platform-reported numbers versus what this installation recorded.</div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <Thead>
            <Tr>
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
              const zoneMismatch = !row.timezoneAligned;
              return (
                <Tr key={rowKey(row, i)}>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium">{row.platform}</span>
                      {row.reasons.length > 0 && (
                        <ConflictTooltip reasons={row.reasons}>
                          <Badge tone="warn">{row.reasons.length}</Badge>
                        </ConflictTooltip>
                      )}
                    </div>
                  </Td>
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
              );
            })}
          </Tbody>
        </Table>
      </div>
      <div className="px-6 py-3 border-t border-ds-line text-[12px] text-ds-muted">
        Spend not attributed to any funnel is excluded here.{' '}
        <a href={unattributedHref} className="underline">
          See the ads reconciliation page
        </a>
        .
      </div>
    </div>
  );
}
