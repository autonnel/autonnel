import React, { useState } from 'react';
import { Card as DsCard, Button as DsButton, Table, Thead, Tbody, Tr, Th, Td } from '../primitives/ds';
import type { SegmentDimension, SegmentDto, SegmentsResponseDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError, PanelEmpty, PanelSkeleton } from './PanelState';
import { countText, moneyText, percentText } from './format';
import { cn } from '@/lib/utils';

const DIMENSIONS: { value: SegmentDimension; label: string }[] = [
  { value: 'channel', label: 'Channel' },
  { value: 'campaign', label: 'Campaign' },
];

function cvrExtremes(segments: SegmentDto[]): { best: string | null; worst: string | null } {
  const withCvr = segments.filter((s) => s.cvr != null);
  if (withCvr.length < 2) return { best: null, worst: null };
  let best = withCvr[0];
  let worst = withCvr[0];
  for (const s of withCvr) {
    if ((s.cvr ?? 0) > (best.cvr ?? 0)) best = s;
    if ((s.cvr ?? 0) < (worst.cvr ?? 0)) worst = s;
  }
  return { best: best.key, worst: worst.key };
}

export default function SegmentBreakdownPanel({ filters }: { filters: DiagnosticsFilters }) {
  const [dimension, setDimension] = useState<SegmentDimension>('channel');
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/segments'>(
    'GET /api/analytics/segments',
    filters,
    { dimension },
  );

  const toggle = (
    <div className="inline-flex rounded-[7px] border border-ds-line p-0.5">
      {DIMENSIONS.map((d) => (
        <DsButton
          key={d.value}
          size="sm"
          variant={dimension === d.value ? 'primary' : 'ghost'}
          onClick={() => setDimension(d.value)}
        >
          {d.label}
        </DsButton>
      ))}
    </div>
  );

  return (
    <DsCard
      title="Segments"
      subtitle="Conversion broken down by traffic source"
      actions={toggle}
    >
      {loading && <PanelSkeleton rows={4} />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && <SegmentContent data={data} />}
    </DsCard>
  );
}

function SegmentContent({ data }: { data: SegmentsResponseDto }) {
  if (data.segments.length === 0) {
    return <PanelEmpty message="No segment data for this range" />;
  }
  const { best, worst } = cvrExtremes(data.segments);
  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Segment</Th>
            <Th align="right">Visitors</Th>
            <Th align="right">Orders</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">CVR</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.segments.map((segment) => (
            <Tr key={segment.key}>
              <Td className="font-medium">{segment.label}</Td>
              <Td align="right" mono>{countText(segment.visitors)}</Td>
              <Td align="right" mono>{countText(segment.orders)}</Td>
              <Td align="right" mono>{moneyText(segment.revenue)}</Td>
              <Td
                align="right"
                mono
                className={cn(
                  segment.key === best && 'text-ds-ok font-semibold',
                  segment.key === worst && 'text-ds-bad font-semibold',
                )}
              >
                {percentText(segment.cvr)}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
