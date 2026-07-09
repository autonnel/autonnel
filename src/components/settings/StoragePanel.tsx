import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
}

interface StoragePanelProps {
  initial: StorageConfig & { hasConfig: boolean; staticDomain: string };
}

const KEEP_SECRET_SENTINEL = '****';

const EMPTY: StorageConfig = { endpoint: '', region: 'auto', bucket: '', accessKeyId: '', secretAccessKey: '', keyPrefix: '' };

export default function StoragePanel({ initial }: StoragePanelProps) {
  const [config, setConfig] = useState<StorageConfig>({
    endpoint: initial.endpoint,
    region: initial.region,
    bucket: initial.bucket,
    accessKeyId: initial.accessKeyId,
    secretAccessKey: '',
    keyPrefix: initial.keyPrefix ?? '',
  });
  const [staticDomain, setStaticDomain] = useState(initial.staticDomain);
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const showForm = !hasConfig || editing;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    setStatus(staticDomain ? 'Uploading test file and fetching via static domain…' : 'Uploading test file to S3…');
    try {
      const secretAccessKey = config.secretAccessKey || (hasConfig ? KEEP_SECRET_SENTINEL : '');
      const data = await apiCall('PUT /api/settings/storage', { ...config, secretAccessKey, staticDomain: staticDomain || null });
      setHasConfig(true);
      setEditing(false);
      setSuccess(true);
      setStatus(
        data.test?.fetched
          ? `Verified. Test file fetched from ${data.test.url}.`
          : 'Verified S3 upload. No static domain configured.',
      );
      setTimeout(() => setSuccess(false), 4000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('autonnel:storage-config-changed'));
      }
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
      setStatus(null);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove S3 storage configuration? Default storage will be used.')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('DELETE /api/settings/storage', null);
      setConfig(EMPTY);
      setHasConfig(false);
      setEditing(false);
      setStatus(null);
      setSuccess(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('autonnel:storage-config-changed'));
      }
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'Bucket', value: config.bucket || '—' },
    { label: 'Region', value: config.region || '—' },
    { label: 'Endpoint', value: config.endpoint || '—' },
    { label: 'Static domain', value: staticDomain || '—' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        S3-compatible storage and CDN-facing static domain. Save uploads a test file and verifies it is reachable through the static domain.
      </div>
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">S3 storage</span>
                <DsBadge tone="ok">Configured</DsBadge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DsButton variant="default" onClick={() => setEditing(true)}>Edit</DsButton>
                <DsButton variant="default" onClick={handleRemove} disabled={removing}>
                  {removing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Remove
                </DsButton>
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {summaryRows.map(row => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">{row.label}</dt>
                  <dd className="text-[13px] text-ds-text break-all">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DsCard>
      ) : (
        <DsCard>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput label="Endpoint" value={config.endpoint} onChange={e => setConfig({ ...config, endpoint: e.target.value })} placeholder="https://s3.amazonaws.com" />
            <FormInput label="Region" value={config.region} onChange={e => setConfig({ ...config, region: e.target.value })} placeholder="auto" />
            <FormInput label="Bucket" value={config.bucket} onChange={e => setConfig({ ...config, bucket: e.target.value })} placeholder="my-bucket" />
            <FormInput label="Access Key ID" value={config.accessKeyId} onChange={e => setConfig({ ...config, accessKeyId: e.target.value })} placeholder="AKIA..." />
            <FormInput label="Secret Access Key" type="password" value={config.secretAccessKey} onChange={e => setConfig({ ...config, secretAccessKey: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'Enter secret key'} />
            <FormInput
              label="Static Domain"
              value={staticDomain}
              onChange={e => setStaticDomain(e.target.value)}
              placeholder="static.example.com"
              hint="CDN-facing domain used to serve uploaded assets. Leave empty to skip the static-domain access test."
            />
            <FormInput
              label="Key Prefix (advanced, optional)"
              value={config.keyPrefix}
              onChange={e => setConfig({ ...config, keyPrefix: e.target.value })}
              placeholder=""
              hint="Optional prefix prepended to every uploaded object key. Leave empty unless you share a bucket across multiple installations."
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-5">
            <DsButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save & verify
            </DsButton>
            {hasConfig && editing && (
              <DsButton variant="default" onClick={() => { setEditing(false); setError(null); setStatus(null); }} disabled={saving}>
                Cancel
              </DsButton>
            )}
            {status && (
              <span className={`text-[12.5px] ${success ? 'text-ds-okText' : 'text-ds-muted'}`}>
                {status}
              </span>
            )}
          </div>
        </DsCard>
      )}
    </div>
  );
}
