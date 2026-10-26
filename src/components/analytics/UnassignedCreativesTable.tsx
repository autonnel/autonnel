import * as React from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../primitives/ds';
import { dsSelectClass } from '../primitives/field-styles';
import { formatMoney } from './ad-diff-cells';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { UnassignedCreativeVM } from '@/lib/dashboard/ads-reconciliation-data';
import type { FunnelOption } from '@/lib/dashboard/analytics-data';

export interface UnassignedCreativesTableProps {
  items: UnassignedCreativeVM[];
  funnelOptions: FunnelOption[];
}

function optionsFor(item: UnassignedCreativeVM, funnelOptions: FunnelOption[]): FunnelOption[] {
  // AMBIGUOUS: the creative's destination URL matches more than one funnel's page, so only those
  // candidates are safe choices. UNMATCHED: no page matched at all, so any funnel is a valid pick.
  if (item.matchState !== 'AMBIGUOUS') return funnelOptions;
  const candidates = new Set(item.candidateFunnelIds);
  return funnelOptions.filter((f) => candidates.has(f.id));
}

function AssignRow({
  item,
  funnelOptions,
  currency,
  onAssigned,
}: {
  item: UnassignedCreativeVM;
  funnelOptions: FunnelOption[];
  currency: string;
  onAssigned: (creativeId: string) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const options = optionsFor(item, funnelOptions);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const funnelId = e.target.value;
    if (!funnelId) return;
    setPending(true);
    setError(null);
    try {
      await apiCall('POST /api/ads/creatives/:id/assign', { funnelId }, { params: { id: item.creativeId } });
      onAssigned(item.creativeId);
    } catch (err) {
      setError(err instanceof ApiCallError ? err.message : 'Could not assign this creative.');
      setPending(false);
    }
  };

  return (
    <Tr>
      <Td>{item.platform}</Td>
      <Td>
        <div className="font-medium">{item.name}</div>
        {item.destinationUrl && <div className="text-[11px] text-ds-faint truncate max-w-[260px]">{item.destinationUrl}</div>}
      </Td>
      <Td className="text-[12px] text-ds-muted">{item.normalizedPath ?? '-'}</Td>
      <Td align="right" mono>{formatMoney(item.spendMinor, currency)}</Td>
      <Td>
        <Badge tone={item.matchState === 'AMBIGUOUS' ? 'warn' : 'bad'}>{item.matchState}</Badge>
      </Td>
      <Td>
        <select
          className={`${dsSelectClass} h-8 min-w-[160px]`}
          defaultValue=""
          disabled={pending || options.length === 0}
          onChange={handleChange}
        >
          <option value="" disabled>
            {options.length === 0 ? 'No candidate funnel' : 'Assign to funnel'}
          </option>
          {options.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
        {error && <div className="text-[11px] text-ds-bad mt-1">{error}</div>}
      </Td>
    </Tr>
  );
}

export default function UnassignedCreativesTable({ items, funnelOptions }: UnassignedCreativesTableProps) {
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const visible = items.filter((i) => !removed.has(i.creativeId));

  if (visible.length === 0) return null;

  const handleAssigned = (creativeId: string) => {
    setRemoved((prev) => new Set(prev).add(creativeId));
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <Thead>
          <Tr>
            <Th>Platform</Th>
            <Th>Ad</Th>
            <Th>Path</Th>
            <Th align="right">Spend</Th>
            <Th>Status</Th>
            <Th>Assign</Th>
          </Tr>
        </Thead>
        <Tbody>
          {visible.map((item) => (
            <AssignRow key={item.creativeId} item={item} funnelOptions={funnelOptions} currency={item.currency} onAssigned={handleAssigned} />
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
