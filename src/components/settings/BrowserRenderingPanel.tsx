import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface BrowserRenderingPanelInitial {
  accountId: string;
  apiTokenMasked: string;
  hasToken: boolean;
}

interface BrowserRenderingPanelProps {
  initial: BrowserRenderingPanelInitial;
}

interface TestResult {
  ok: boolean;
  htmlSize?: number;
  error?: string;
}

export default function BrowserRenderingPanel({ initial }: BrowserRenderingPanelProps) {
  const [accountId, setAccountId] = useState(initial.accountId);
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [apiTokenMasked, setApiTokenMasked] = useState(initial.apiTokenMasked);
  const [hasToken, setHasToken] = useState(initial.hasToken);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const showForm = !hasToken || editing;

  const tokenPlaceholder = apiTokenMasked
    ? `Stored: ${apiTokenMasked} (leave blank to keep)`
    : 'cf-api-token...';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      const data = await apiCall('PUT /api/settings/browser-rendering', { accountId, apiToken });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setApiToken('');
      setApiTokenMasked(data.apiTokenMasked);
      setHasToken(data.hasToken);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the Browser Rendering configuration?')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('PUT /api/settings/browser-rendering', { accountId: null, apiToken: null });
      setAccountId('');
      setApiToken('');
      setApiTokenMasked('');
      setHasToken(false);
      setEditing(false);
      setTestResult(null);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const data = await apiCall('POST /api/settings/browser-rendering/test', { accountId, apiToken });
      setTestResult(data);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'unknown' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Cloudflare Browser Rendering captures fully-rendered HTML (including
        JS-injected images and lazy components) when importing pages from
        external URLs. Without it, page import uses a plain HTTP fetch which
        may miss dynamic assets.{' '}
        <a
          href="https://developers.cloudflare.com/browser-rendering/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ds-ink"
        >
          Docs
        </a>
        .
      </div>
      <AlertBox type="warning">
        Browser Rendering is optional. When unset, page import falls back to
        a plain fetch (Tier 0) which works for static sites but misses ~12%
        of assets on JS-heavy pages.
      </AlertBox>
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">Browser Rendering</span>
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
                <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">Account ID</dt>
                <dd className="text-[13px] text-ds-text break-all">{accountId || '—'}</dd>
              </div>
            </dl>
          </div>
        </DsCard>
      ) : (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 pb-4 border-b border-ds-line">
              <div className="text-[13px] font-medium text-ds-ink">
                How to get Account ID and API Token
              </div>
              <ol className="list-decimal list-outside ml-4 text-[12.5px] text-ds-muted flex flex-col gap-1">
                <li>
                  Open the{' '}
                  <a
                    href="https://dash.cloudflare.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-ds-ink"
                  >
                    Cloudflare dashboard
                  </a>{' '}
                  and go to{' '}
                  <span className="text-ds-ink">Manage Account → Account API Tokens</span>.
                </li>
                <li>
                  Click <span className="text-ds-ink">Create Token</span> →{' '}
                  <span className="text-ds-ink">Create Custom Token</span>.
                </li>
                <li>
                  Under <span className="text-ds-ink">Permissions</span>, add{' '}
                  <span className="text-ds-ink">Account → Browser Rendering → Edit</span>.
                </li>
                <li>
                  Confirm and create the token. The result page shows your{' '}
                  <span className="text-ds-ink">Account ID</span> and{' '}
                  <span className="text-ds-ink">API Token</span> — copy both into the
                  fields below.
                </li>
              </ol>
            </div>
            <FormInput
              label="Account ID"
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="Cloudflare account ID"
            />
            <div className="flex flex-col gap-1.5">
              <FormInput
                label="API Token"
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={tokenPlaceholder}
              />
              <div className="flex items-center gap-2 text-[12px] text-ds-muted">
                <button
                  type="button"
                  className="underline hover:text-ds-ink"
                  onClick={() => setShowToken((s) => !s)}
                >
                  {showToken ? 'Hide' : 'Show'}
                </button>
                <span>Token needs the &ldquo;Browser Rendering&rdquo; permission.</span>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <DsButton variant="primary" onClick={handleSave} disabled={saving || testing || removing}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              <DsButton
                variant="default"
                onClick={handleTest}
                disabled={saving || testing || removing || (!hasToken && !apiToken)}
              >
                {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                Test Connection
              </DsButton>
              {hasToken && editing && (
                <DsButton variant="default" onClick={() => { setEditing(false); setError(null); setApiToken(''); setTestResult(null); }} disabled={saving}>
                  Cancel
                </DsButton>
              )}
              {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
            </div>
            {testResult && testResult.ok && (
              <div className="text-[12.5px] text-ds-okText">
                Connected. Received {testResult.htmlSize ?? 0} bytes from example.com.
              </div>
            )}
            {testResult && !testResult.ok && (
              <AlertBox type="error">{testResult.error || 'Test failed'}</AlertBox>
            )}
          </div>
        </DsCard>
      )}
    </div>
  );
}
