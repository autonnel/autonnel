import { useState } from 'react';
import { AlertBox } from '@/components/primitives';
import PairingsSection from './notifications/PairingsSection';
import RecordsTable from './notifications/RecordsTable';
import {
  type MaskedPairing,
  type NotificationsPanelInitial,
} from './notifications/types';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { NotificationPairing } from '@/lib/notifications/routing-types';

interface Props {
  initial: NotificationsPanelInitial;
}

function maskedToWire(p: MaskedPairing): NotificationPairing {
  if (p.channel.type === 'email') {
    return {
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      events: p.events,
      channel: { type: 'email', recipients: p.channel.recipients },
    };
  }
  if (p.channel.type === 'slack') {
    return {
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      events: p.events,
      channel: { type: 'slack', webhookUrl: p.channel.webhookUrl.startsWith('••••') ? '' : p.channel.webhookUrl },
    };
  }
  return {
    id: p.id,
    name: p.name,
    enabled: p.enabled,
    events: p.events,
    channel: {
      type: 'webhook',
      url: p.channel.url.startsWith('••••') ? '' : p.channel.url,
      secret: p.channel.secret.startsWith('••••') ? undefined : p.channel.secret || undefined,
    },
  };
}

export default function NotificationsPanel({ initial }: Props) {
  const [pairings, setPairings] = useState<MaskedPairing[]>(initial.pairings);
  const [error, setError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);

  const persistPairings = async (next: MaskedPairing[]): Promise<void> => {
    setError(null);
    try {
      const wire = next.map(maskedToWire);
      const data = await apiCall('PUT /api/settings/notifications', { pairings: wire });
      setPairings(data.pairings);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async (p: MaskedPairing) => {
    setTestingId(p.id);
    setTestResult(null);
    setError(null);
    try {
      const data = await apiCall('POST /api/settings/notifications/test', { pairing: maskedToWire(p) });
      setTestResult({ id: p.id, ok: !!data.ok, msg: data.ok ? 'Test sent' : data.error || 'Test failed' });
    } catch (err) {
      setTestResult({ id: p.id, ok: false, msg: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-[12.5px] text-ds-muted">
        Route events to email, Slack, or webhook channels. Configure AI conversion analysis cadence in{' '}
        <a className="underline" href="/settings/ai-conversion-analysis">AI Conversion Analysis</a>.
      </div>

      {error && <AlertBox type="error">{error}</AlertBox>}
      {testResult && (
        <AlertBox type={testResult.ok ? 'success' : 'error'}>
          [{testResult.id}] {testResult.msg}
        </AlertBox>
      )}

      <PairingsSection
        pairings={pairings}
        onPersist={persistPairings}
        onTest={handleTest}
        testingId={testingId}
      />

      <RecordsTable />
    </div>
  );
}
