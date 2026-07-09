import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface GoogleMapsPanelInitial {
  apiKeyMasked: string;
  hasConfig: boolean;
}

interface GoogleMapsPanelProps {
  initial: GoogleMapsPanelInitial;
}

export default function GoogleMapsPanel({ initial }: GoogleMapsPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState(initial.apiKeyMasked);
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const showForm = !hasConfig || editing;

  const apiKeyPlaceholder = apiKeyMasked
    ? `Stored: ${apiKeyMasked} (leave blank to keep)`
    : 'AIza...';

  const handleSave = async () => {
    if (!apiKey) {
      setError('Enter an API key to save');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await apiCall('PUT /api/settings/google-maps', { apiKey });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setApiKey('');
      setApiKeyMasked(data.apiKeyMasked);
      setHasConfig(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the Google Maps API key?')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('PUT /api/settings/google-maps', { apiKey: null });
      setApiKey('');
      setApiKeyMasked('');
      setHasConfig(false);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Google Maps API key used by features such as address autocomplete in checkout.
      </div>
      <AlertBox type="warning">
        Google Maps API key is optional. When unset, features that depend on it (address autocomplete
        in checkout) will be unavailable, but the rest of the app works normally.
      </AlertBox>
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">Google Maps</span>
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
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">API key</dt>
                <dd className="text-[13px] text-ds-text break-all">{apiKeyMasked || '••••'}</dd>
              </div>
            </dl>
          </div>
        </DsCard>
      ) : (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <FormInput
                label="API Key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={apiKeyPlaceholder}
              />
              <div className="flex items-center gap-2 text-[12px] text-ds-muted">
                <button
                  type="button"
                  className="underline hover:text-ds-ink"
                  onClick={() => setShowApiKey((s) => !s)}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <DsButton variant="primary" onClick={handleSave} disabled={saving || removing}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              {hasConfig && editing && (
                <DsButton variant="default" onClick={() => { setEditing(false); setError(null); setApiKey(''); }} disabled={saving}>
                  Cancel
                </DsButton>
              )}
              {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
            </div>
          </div>
        </DsCard>
      )}
    </div>
  );
}
