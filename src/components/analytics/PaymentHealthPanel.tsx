import React from 'react';
import { Card as DsCard, Badge, Table, Thead, Tbody, Tr, Th, Td } from '../primitives/ds';
import type { PaymentsResponseDto, ProviderHealthDto } from '@/contracts/analytics-diagnostics';
import { useDiagnosticsQuery, type DiagnosticsFilters } from './use-diagnostics-query';
import { PanelError, PanelEmpty, PanelSkeleton } from './PanelState';
import { countText, percentText } from './format';

const SUCCESS_OK = 95;
const SUCCESS_WARN = 80;

function successTone(rate: number | null): 'ok' | 'warn' | 'bad' | 'muted' {
  if (rate == null) return 'muted';
  if (rate >= SUCCESS_OK) return 'ok';
  if (rate >= SUCCESS_WARN) return 'warn';
  return 'bad';
}

function errorTone(rate: number | null): 'ok' | 'warn' | 'bad' | 'muted' {
  if (rate == null) return 'muted';
  if (rate <= 100 - SUCCESS_OK) return 'ok';
  if (rate <= 100 - SUCCESS_WARN) return 'warn';
  return 'bad';
}

function ProviderRow({ provider }: { provider: ProviderHealthDto }) {
  return (
    <Tr>
      <Td className="font-medium">{provider.provider}</Td>
      <Td align="right" mono>{countText(provider.attempts)}</Td>
      <Td align="right" mono>{countText(provider.successes)}</Td>
      <Td align="right" mono>{countText(provider.errors)}</Td>
      <Td align="right">
        <Badge tone={successTone(provider.successRate)}>{percentText(provider.successRate)}</Badge>
      </Td>
      <Td align="right">
        <Badge tone={errorTone(provider.errorRate)}>{percentText(provider.errorRate)}</Badge>
      </Td>
    </Tr>
  );
}

export default function PaymentHealthPanel({ filters }: { filters: DiagnosticsFilters }) {
  const { data, loading, error } = useDiagnosticsQuery<'GET /api/analytics/payments'>(
    'GET /api/analytics/payments',
    filters,
  );

  return (
    <DsCard title="Payment health" subtitle="Authorization attempts and success rates per provider">
      {loading && <PanelSkeleton rows={3} />}
      {!loading && error && <PanelError message={error} />}
      {!loading && !error && data && <PaymentHealthContent data={data} />}
    </DsCard>
  );
}

function PaymentHealthContent({ data }: { data: PaymentsResponseDto }) {
  if (data.providers.length === 0) {
    return <PanelEmpty message="No payment attempts for this range" />;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Provider</Th>
            <Th align="right">Attempts</Th>
            <Th align="right">Successes</Th>
            <Th align="right">Errors</Th>
            <Th align="right">Success rate</Th>
            <Th align="right">Error rate</Th>
          </Tr>
        </Thead>
        <Tbody>
          {data.providers.map((provider) => (
            <ProviderRow key={provider.provider} provider={provider} />
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
