import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import {
  pollSyncStatus,
  rateLimitMessage,
  type SyncRunView,
  type SyncStatusResponse,
  type SyncRateLimitError,
} from '@/lib/dashboard/ads-refresh-client';
import type { AdsAppPlatformWire, AdsAppConnectionWire } from '@/contracts/settings';

interface AdsAppsPanelProps {
  initial: { platforms: AdsAppPlatformWire[] };
}

type RefreshPhase = 'idle' | 'starting' | 'polling' | 'rate-limited';

async function fetchSyncStatus(): Promise<SyncStatusResponse> {
  const res = await fetch('/api/ads/sync/status');
  if (!res.ok) throw new Error(`status check failed (${res.status})`);
  return (await res.json()) as SyncStatusResponse;
}

function connectHref(platform: string, mode?: 'relay'): string {
  const base = `/api/ads/oauth/${encodeURIComponent(platform.toLowerCase())}/authorize`;
  return mode ? `${base}?mode=relay` : base;
}

function ConnectionRow({
  connection,
  run,
  onRefresh,
  disabled,
  busy,
}: {
  connection: AdsAppConnectionWire;
  run: SyncRunView | undefined;
  onRefresh: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2.5 border-t border-ds-line first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[13px] text-ds-ink truncate">{connection.externalAccountId}</span>
          <span className="text-[11.5px] text-ds-muted">
            {connection.status}
            {connection.reportingTimezone ? ` · ${connection.reportingTimezone}` : ''}
          </span>
        </div>
        <DsButton variant="default" size="sm" onClick={onRefresh} disabled={disabled}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Refresh
        </DsButton>
      </div>
      {run && run.status === 'FAILED' && (
        <div className="text-[11.5px] text-ds-badText break-all">Last refresh failed: {run.error ?? 'unknown error'}</div>
      )}
      {run && run.status === 'OK' && run.truncated && (
        <div className="text-[11.5px] text-ds-warnText">Last refresh only partially fetched this account's spend.</div>
      )}
      {run && run.status === 'OK' && !run.truncated && (
        <div className="text-[11.5px] text-ds-okText">Last refresh completed.</div>
      )}
    </div>
  );
}

function PlatformCard({ platform }: { platform: AdsAppPlatformWire }) {
  const [hasConfig, setHasConfig] = useState(platform.hasConfig);
  const [clientIdMasked, setClientIdMasked] = useState(platform.clientIdMasked);
  const [hasDeveloperToken, setHasDeveloperToken] = useState(platform.hasDeveloperToken);
  const [connections, setConnections] = useState(platform.connections);
  const [editing, setEditing] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [developerToken, setDeveloperToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshPhase, setRefreshPhase] = useState<RefreshPhase>('idle');
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [runsByConnection, setRunsByConnection] = useState<Record<string, SyncRunView>>({});

  const showForm = !hasConfig || editing;
  const isGoogle = platform.platform === 'GOOGLE';
  const isBing = platform.platform === 'BING_ADS';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // clientId has no "blank means keep" semantic on the server (blank/null means delete), and
      // unlike clientSecret there is never a plaintext value to prefill on Edit (the wire only
      // ever carries a masked id) -- so an untouched field must be OMITTED, not sent blank, or
      // Save silently wipes the stored client id.
      const input: Record<string, unknown> = { platform: platform.platform, clientSecret };
      if (clientId.trim().length > 0) input.clientId = clientId;
      if (isGoogle) input.developerToken = developerToken;
      const data = await apiCall('PUT /api/settings/ads', input as never);
      const updated = data.platforms.find((p) => p.platform === platform.platform);
      if (updated) {
        setHasConfig(updated.hasConfig);
        setClientIdMasked(updated.clientIdMasked);
        setHasDeveloperToken(updated.hasDeveloperToken);
        setConnections(updated.connections);
      }
      setClientId('');
      setClientSecret('');
      setDeveloperToken('');
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove the ${platform.label} app credentials?`)) return;
    setRemoving(true);
    setError(null);
    try {
      const data = await apiCall('PUT /api/settings/ads', {
        platform: platform.platform,
        clientId: null,
        clientSecret: null,
        ...(isGoogle ? { developerToken: null } : {}),
      } as never);
      const updated = data.platforms.find((p) => p.platform === platform.platform);
      if (updated) {
        setHasConfig(updated.hasConfig);
        setClientIdMasked(updated.clientIdMasked);
        setHasDeveloperToken(updated.hasDeveloperToken);
        setConnections(updated.connections);
      }
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const settleAfterSync = async (connectionId: string) => {
    const status = await pollSyncStatus({ fetchStatus: fetchSyncStatus });
    const run = status.runs.find((r) => r.connectionId === connectionId);
    if (run) setRunsByConnection((prev) => ({ ...prev, [connectionId]: run }));
    setRefreshPhase('idle');
    setRefreshingId(null);
  };

  const handleRefresh = async (connectionId: string) => {
    setRefreshPhase('starting');
    setRefreshingId(connectionId);
    setRefreshMessage(null);
    try {
      const res = await fetch('/api/ads/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      if (res.status === 429) {
        const err = (await res.json()) as SyncRateLimitError;
        setRefreshPhase('rate-limited');
        setRefreshMessage(rateLimitMessage(err));
        const waitMs = Math.max(1, err.retryAfterSeconds) * 1000;
        setTimeout(() => {
          setRefreshPhase('idle');
          setRefreshingId(null);
          setRefreshMessage(null);
        }, waitMs);
        return;
      }
      if (!res.ok) {
        setRefreshPhase('idle');
        setRefreshingId(null);
        setRefreshMessage('Could not start a refresh. Try again.');
        return;
      }
      setRefreshPhase('polling');
      await settleAfterSync(connectionId);
    } catch {
      setRefreshPhase('idle');
      setRefreshingId(null);
      setRefreshMessage('Could not start a refresh. Try again.');
    }
  };

  const refreshBusy = refreshPhase !== 'idle';
  const connectBlockedReason = isBing
    ? 'OAuth connect is not supported for Bing Ads in this UI; Bing connections are token-based.'
    : !hasConfig
      ? 'Configure Client ID and Secret first.'
      : null;

  return (
    <DsCard>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-[15px] font-semibold text-ds-ink">{platform.label}</span>
            {hasConfig && <DsBadge tone="ok">Configured</DsBadge>}
          </div>
          {!showForm && (
            <div className="flex items-center gap-2 shrink-0">
              <DsButton variant="default" onClick={() => setEditing(true)}>Edit</DsButton>
              <DsButton variant="default" onClick={handleRemove} disabled={removing}>
                {removing && <Loader2 className="h-4 w-4 animate-spin" />}
                Remove
              </DsButton>
            </div>
          )}
        </div>

        {error && <AlertBox type="error">{error}</AlertBox>}

        {platform.platform === 'TIKTOK' && (
          <AlertBox type="info">
            Hosted relay authorization is not available for TikTok: the relay's TikTok integration
            only grants creator-content scopes, not the Ads Marketing API, so its token cannot read
            ad spend or clicks. Register your own TikTok app below to connect an account.
          </AlertBox>
        )}
        {isBing && (
          <AlertBox type="info">
            No hosted relay is available for Bing Ads. Bing Ads supports conversion postbacks only;
            spend and click reporting is not available.
          </AlertBox>
        )}

        {platform.relayEnabled && (
          <div>
            <DsButton
              variant="default"
              onClick={() => { window.location.href = connectHref(platform.platform, 'relay'); }}
            >
              Use our app
            </DsButton>
          </div>
        )}

        {showForm ? (
          <div className="flex flex-col gap-3">
            <FormInput
              label="Client ID"
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={hasConfig ? `Stored: ${clientIdMasked} (leave blank to keep)` : 'OAuth app client id'}
            />
            <FormInput
              label="Client Secret"
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={hasConfig ? 'Leave blank to keep the stored secret' : 'OAuth app client secret'}
            />
            {isGoogle && (
              <FormInput
                label="Developer Token"
                type="password"
                value={developerToken}
                onChange={(e) => setDeveloperToken(e.target.value)}
                placeholder={hasDeveloperToken ? 'Leave blank to keep the stored token' : 'Optional'}
                hint="Leave blank to use the platform's built-in developer token. Fill in to override with your own."
              />
            )}
            <div className="flex items-center gap-3 pt-1">
              <DsButton variant="primary" onClick={handleSave} disabled={saving || removing}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              {hasConfig && editing && (
                <DsButton
                  variant="default"
                  onClick={() => { setEditing(false); setError(null); setClientId(''); setClientSecret(''); setDeveloperToken(''); }}
                  disabled={saving}
                >
                  Cancel
                </DsButton>
              )}
              {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            <div className="flex flex-col gap-0.5">
              <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">Client ID</dt>
              <dd className="text-[13px] text-ds-text break-all">{clientIdMasked || '-'}</dd>
            </div>
            {isGoogle && (
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">Developer Token</dt>
                <dd className="text-[13px] text-ds-text">{hasDeveloperToken ? 'Custom' : 'Built-in default'}</dd>
              </div>
            )}
          </dl>
        )}

        <div className="flex flex-col gap-1 pt-2 border-t border-ds-line">
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-[12.5px] font-medium text-ds-ink">Connected accounts</span>
            <DsButton
              variant="default"
              size="sm"
              disabled={!!connectBlockedReason}
              onClick={() => { window.location.href = connectHref(platform.platform); }}
            >
              Connect
            </DsButton>
          </div>
          {connectBlockedReason && <div className="text-[11.5px] text-ds-muted">{connectBlockedReason}</div>}
          {refreshMessage && <div className="text-[11.5px] text-ds-muted">{refreshMessage}</div>}
          {connections.length === 0 ? (
            <div className="text-[12.5px] text-ds-muted py-1">No accounts connected yet.</div>
          ) : (
            connections.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                run={runsByConnection[c.id]}
                onRefresh={() => handleRefresh(c.id)}
                disabled={refreshBusy}
                busy={refreshingId === c.id && refreshBusy}
              />
            ))
          )}
        </div>
      </div>
    </DsCard>
  );
}

export default function AdsAppsPanel({ initial }: AdsAppsPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {initial.platforms.map((platform) => (
        <PlatformCard key={platform.platform} platform={platform} />
      ))}
    </div>
  );
}
