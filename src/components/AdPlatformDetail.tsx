import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import AdEventMappings from './AdEventMappings';
import AlertBox from './primitives/AlertBox';
import { Button } from './primitives/Button';
import { Card, CardContent, CardHeader, CardTitle } from './primitives/Card';
import FormInput from './primitives/FormInput';
import StatusBadge from './primitives/StatusBadge';
import { ThemeProvider } from './primitives/ThemeProvider';
import { apiCall, ApiCallError } from '@/lib/api/client';

type PlatformKind = 'FACEBOOK' | 'TIKTOK' | 'GOOGLE_ADS' | 'BING_ADS';
type Notice = { type: 'success' | 'error'; text: string };
type CredentialDraft = Record<string, string>;
type SaveResponse = { error?: string };
type TestEventResponse = { success?: boolean; message?: string; error?: string };

interface FunnelBinding {
  id: string;
  funnel: { id: string; name: string; slug: string };
}

interface AdPlatform {
  id: string;
  name: string;
  platform: PlatformKind;
  credentials: CredentialDraft & {
    mode?: 'token' | 'oauth';
    adAccountId?: string;
    pixelId?: string;
    pixelCode?: string;
  };
  isActive: boolean;
  createdAt: string;
  funnelBindings: FunnelBinding[];
  _count: { postbacks: number };
}

interface AdPlatformDetailProps {
  platform: AdPlatform;
}

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

const PLATFORM_INFO: Record<PlatformKind, {
  name: string;
  marker: string;
  color: string;
  fields: CredentialField[];
}> = {
  FACEBOOK: {
    name: 'Facebook',
    marker: 'f',
    color: '#1877F2',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: 'Enter your Facebook Pixel ID' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Enter your Conversions API access token', type: 'password' },
    ],
  },
  TIKTOK: {
    name: 'TikTok',
    marker: 'T',
    color: '#111827',
    fields: [
      { key: 'pixelCode', label: 'Pixel Code', placeholder: 'Enter your TikTok Pixel Code' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Enter your Events API access token', type: 'password' },
    ],
  },
  GOOGLE_ADS: {
    name: 'Google Ads',
    marker: 'G',
    color: '#4285F4',
    fields: [],
  },
  BING_ADS: {
    name: 'Bing Ads',
    marker: 'B',
    color: '#008373',
    fields: [
      { key: 'uetTagId', label: 'UET Tag ID', placeholder: 'Enter your Microsoft Ads UET Tag ID' },
      { key: 'capiToken', label: 'Conversion API Token', placeholder: 'Enter your Conversion API token', type: 'password' },
    ],
  },
};

function metaFor(p: string) {
  return (
    PLATFORM_INFO[String(p).toUpperCase() as PlatformKind] ?? {
      name: p || 'Platform',
      marker: (p?.[0] || '?').toUpperCase(),
      color: '#6b7280',
      fields: [] as CredentialField[],
    }
  );
}

function useReauthorizationNotice(setMessage: (message: Notice) => void) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'reauthorized') return;

    setMessage({
      type: 'success',
      text: 'Re-authorization completed successfully. Your access token has been updated.',
    });
    window.history.replaceState({}, '', window.location.pathname);
  }, [setMessage]);
}

function hasValues(credentials: CredentialDraft) {
  return Object.values(credentials).some(value => value.trim() !== '');
}

function missingLabels(fields: CredentialField[], credentials: CredentialDraft) {
  return fields
    .filter(field => !credentials[field.key]?.trim())
    .map(field => field.label);
}

function BrandMark({ platform }: { platform: AdPlatform }) {
  const info = metaFor(platform.platform);

  return (
    <div
      className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold"
      style={{ backgroundColor: `${info.color}20`, color: info.color }}
    >
      {info.marker}
    </div>
  );
}

function BackLink() {
  return (
    <a href="/marketing" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 no-underline">
      <ArrowLeft className="w-4 h-4" />
      Back to Ad Platforms
    </a>
  );
}

function HeaderBlock({ platform }: { platform: AdPlatform }) {
  const info = metaFor(platform.platform);

  return (
    <div className="flex items-center gap-4 mb-8">
      <BrandMark platform={platform} />
      <div className="flex-1">
        <h1 className="text-2xl font-bold">{platform.name}</h1>
        <p className="text-muted-foreground">{info.name} Conversions API</p>
      </div>
      <StatusBadge status={platform.isActive ? 'Active' : 'Inactive'} />
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <Card className="p-5">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

function PlatformStats({ platform }: { platform: AdPlatform }) {
  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      <StatCard value={platform.funnelBindings.length} label="Connected Funnels" />
      <StatCard value={platform._count.postbacks} label="Total Postbacks" />
    </div>
  );
}

function ConnectedFunnels({ bindings }: { bindings: FunnelBinding[] }) {
  if (bindings.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-4">Connected Funnels</h2>
      <Card className="divide-y divide-white/6 p-0">
        {bindings.map(binding => (
          <a
            key={binding.id}
            href={`/funnel/${binding.funnel.id}`}
            className="flex items-center justify-between p-4 hover:bg-muted/50 no-underline text-foreground first:rounded-t-2xl last:rounded-b-2xl"
          >
            <span>{binding.funnel.name}</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </a>
        ))}
      </Card>
    </div>
  );
}

function OAuthCredentials({ platform }: { platform: AdPlatform }) {
  const pixelId = platform.credentials.pixelId || platform.credentials.pixelCode;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-medium text-foreground mb-4">Authorization</h3>
      <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border mb-4">
        <CredentialLine label="Mode">
          <StatusBadge status="OAuth" size="sm" />
        </CredentialLine>
        {platform.credentials.adAccountId && (
          <CredentialLine label="Ad Account ID">
            <span className="text-sm font-mono">{platform.credentials.adAccountId}</span>
          </CredentialLine>
        )}
        {pixelId && (
          <CredentialLine label="Pixel ID">
            <span className="text-sm font-mono">{pixelId}</span>
          </CredentialLine>
        )}
      </div>
    </div>
  );
}

function CredentialLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function TokenCredentials({
  platform,
  credentials,
  setCredentials,
}: {
  platform: AdPlatform;
  credentials: CredentialDraft;
  setCredentials: React.Dispatch<React.SetStateAction<CredentialDraft>>;
}) {
  const fields = metaFor(platform.platform).fields;

  return (
    <>
      <div className="mt-6 mb-4">
        <h3 className="text-sm font-medium text-foreground mb-2">Credentials</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Current credentials are masked. Enter new values to update them.
        </p>
      </div>
      {fields.map(field => (
        <FormInput
          key={field.key}
          label={field.label}
          type={field.type || 'text'}
          value={credentials[field.key] || ''}
          onChange={event => setCredentials(current => ({ ...current, [field.key]: event.target.value }))}
          placeholder={`Enter new ${field.label.toLowerCase()}`}
          hint={`Current: ${platform.credentials[field.key] || '(not set)'}`}
          className="mb-4"
        />
      ))}
    </>
  );
}

function SettingsForm({ platform }: { platform: AdPlatform }) {
  const [name, setName] = useState(platform.name);
  const [credentials, setCredentials] = useState<CredentialDraft>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Notice | null>(null);
  const info = metaFor(platform.platform);
  const isOAuthMode = platform.credentials.mode === 'oauth';

  useReauthorizationNotice(setMessage);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const updateData: { name: string; credentials?: CredentialDraft } = { name };

      if (hasValues(credentials)) {
        const missing = missingLabels(info.fields, credentials);
        if (missing.length > 0) {
          setMessage({ type: 'error', text: `Please fill in all credential fields: ${missing.join(', ')}` });
          setIsSaving(false);
          return;
        }
        updateData.credentials = credentials;
      }

      const response = await fetch(`/api/marketing/${platform.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Changes saved successfully' });
        setCredentials({});
      } else {
        const data = await response.json() as SaveResponse;
        setMessage({ type: 'error', text: data.error || 'Failed to save changes' });
      }
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'Failed to save changes' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {message && <AlertBox type={message.type} className="mb-6">{message.text}</AlertBox>}
        <form onSubmit={handleSave}>
          <FormInput
            label="Name"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Platform name"
            required
          />
          {isOAuthMode ? (
            <OAuthCredentials platform={platform} />
          ) : (
            <TokenCredentials platform={platform} credentials={credentials} setCredentials={setCredentials} />
          )}
          <div className="flex gap-3 mt-8">
            <Button type="button" variant="secondary" onClick={() => window.location.href = '/marketing'} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="default" disabled={isSaving} className="flex-1">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function useTestEventSender(platformId: string) {
  const [testEventCode, setTestEventCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<Notice | null>(null);

  const send = async () => {
    const code = testEventCode.trim();
    if (!code) return;

    setIsSending(true);
    setResult(null);

    try {
      const data = await apiCall('POST /api/marketing/:id/test-event', { testEventCode: code }, { params: { id: platformId } });
      setResult(data.accepted
        ? { type: 'success', text: 'Test event sent successfully' }
        : { type: 'error', text: data.reason || 'Failed to send test event' }
      );
    } catch (err) {
      const text = err instanceof ApiCallError ? err.message : 'Network error. Please try again.';
      setResult({ type: 'error', text });
    } finally {
      setIsSending(false);
    }
  };

  return { testEventCode, setTestEventCode, isSending, result, send };
}

function TikTokTestEvent({ platformId }: { platformId: string }) {
  const state = useTestEventSender(platformId);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Test Event</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Send a test event to TikTok Events Manager. Enter the test event code from your TikTok Events Manager &gt; Test Events tool.
        </p>
        {state.result && <AlertBox type={state.result.type} className="mb-4">{state.result.text}</AlertBox>}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FormInput
              label="Test Event Code"
              value={state.testEventCode}
              onChange={event => state.setTestEventCode(event.target.value)}
              placeholder="e.g. TEST12345"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={state.isSending || !state.testEventCode.trim()}
            onClick={state.send}
            className="shrink-0"
          >
            {state.isSending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Test Event
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OptionalPlatformTools({ platform }: { platform: AdPlatform }) {
  const supportsMapping = useMemo(
    () => platform.platform === 'FACEBOOK' || platform.platform === 'TIKTOK',
    [platform.platform]
  );

  return (
    <>
      {platform.platform === 'TIKTOK' && <TikTokTestEvent platformId={platform.id} />}
      {supportsMapping && (
        <div className="mt-8">
          <AdEventMappings adPlatformId={platform.id} platform={platform.platform} />
        </div>
      )}
    </>
  );
}

export default function AdPlatformDetail({ platform }: AdPlatformDetailProps) {
  return (
    <ThemeProvider>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <BackLink />
        <HeaderBlock platform={platform} />
        <PlatformStats platform={platform} />
        <ConnectedFunnels bindings={platform.funnelBindings} />
        <SettingsForm platform={platform} />
        <OptionalPlatformTools platform={platform} />
      </main>
    </ThemeProvider>
  );
}
