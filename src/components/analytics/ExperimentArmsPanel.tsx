import React from 'react';
import { Card as DsCard, Table, Thead, Tbody, Tr, Th, Td } from '../primitives/ds';
import type { ExperimentsResponseDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError, PanelEmpty, PanelSkeleton } from './PanelState';
import { countText, moneyText, percentText } from './format';

export default function ExperimentArmsPanel({ filters }: { filters: DiagnosticsFilters }) {
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/experiments'>(
    'GET /api/analytics/experiments',
    filters,
  );

  return (
    <DsCard title="Experiment arms" subtitle="Conversion per A/B variant in this funnel">
      {loading && <PanelSkeleton rows={2} />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && <ExperimentContent data={data} />}
    </DsCard>
  );
}

function ExperimentContent({ data }: { data: ExperimentsResponseDto }) {
  if (data.arms.length === 0) {
    return <PanelEmpty message="No experiment data for this range" />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Arm</Th>
            <Th align="right">Visitors</Th>
            <Th align="right">Orders</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">CVR</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.arms.map((arm) => (
            <Tr key={arm.key}>
              <Td className="font-medium">{arm.label}</Td>
              <Td align="right" mono>{countText(arm.visitors)}</Td>
              <Td align="right" mono>{countText(arm.orders)}</Td>
              <Td align="right" mono>{moneyText(arm.revenue)}</Td>
              <Td align="right" mono>{percentText(arm.cvr)}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
