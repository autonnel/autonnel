import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, FormSelect, AlertBox } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

type Provider = 'SMTP' | 'RESEND';

const PROVIDER_LABEL: Record<Provider, string> = {
  SMTP: 'SMTP',
  RESEND: 'Resend',
};

interface EmailConfigInitial {
  hasConfig: boolean;
  provider: Provider;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  isActive: boolean;
  smtpCreds: { host: string; port: number; username: string; secure: boolean };
}

interface EmailConfigPanelProps {
  initial: EmailConfigInitial;
}

export default function EmailConfigPanel({ initial }: EmailConfigPanelProps) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [fromEmail, setFromEmail] = useState(initial.fromEmail);
  const [fromName, setFromName] = useState(initial.fromName);
  const [replyTo, setReplyTo] = useState(initial.replyTo);
  const [isActive] = useState(initial.isActive);
  const [smtpCreds, setSmtpCreds] = useState({
    host: initial.smtpCreds.host,
    port: initial.smtpCreds.port,
    username: initial.smtpCreds.username,
    password: '',
    secure: initial.smtpCreds.secure,
  });
  const [resendCreds, setResendCreds] = useState({ apiKey: '' });
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const showForm = !hasConfig || editing;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const credentials = provider === 'SMTP' ? smtpCreds : resendCreds;
      await apiCall('PUT /api/settings/email', {
        provider,
        credentials,
        fromEmail,
        fromName,
        replyTo,
        isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setHasConfig(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the email provider configuration?')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('DELETE /api/settings/email', null);
      setHasConfig(false);
      setEditing(false);
      setSmtpCreds(c => ({ ...c, password: '' }));
      setResendCreds({ apiKey: '' });
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'From email', value: fromEmail || '—' },
    { label: 'From name', value: fromName || '—' },
    { label: 'Reply-to', value: replyTo || '—' },
    ...(provider === 'SMTP'
      ? [{ label: 'SMTP host', value: smtpCreds.host ? `${smtpCreds.host}:${smtpCreds.port}` : '—' }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">SMTP or Resend for transactional emails.</div>
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">{PROVIDER_LABEL[provider]}</span>
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
          <div className="flex flex-col gap-4">
            <FormSelect label="Provider" value={provider} onChange={e => setProvider(e.target.value as Provider)}>
              <option value="SMTP">SMTP</option>
              <option value="RESEND">Resend</option>
            </FormSelect>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="From Email" type="email" value={fromEmail} onChange={e => setFromEmail(e.target.value)} placeholder="noreply@example.com" />
              <FormInput label="From Name" value={fromName} onChange={e => setFromName(e.target.value)} placeholder="My Store" />
            </div>
            <FormInput label="Reply-To" type="email" value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="support@example.com" />

            {provider === 'SMTP' ? (
              <div className="grid grid-cols-2 gap-4 border-t border-ds-line pt-4">
                <FormInput label="Host" value={smtpCreds.host} onChange={e => setSmtpCreds({ ...smtpCreds, host: e.target.value })} placeholder="smtp.example.com" />
                <FormInput label="Port" type="number" value={String(smtpCreds.port)} onChange={e => setSmtpCreds({ ...smtpCreds, port: parseInt(e.target.value, 10) || 587 })} placeholder="587" />
                <FormInput label="Username" value={smtpCreds.username} onChange={e => setSmtpCreds({ ...smtpCreds, username: e.target.value })} />
                <FormInput label="Password" type="password" value={smtpCreds.password} onChange={e => setSmtpCreds({ ...smtpCreds, password: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'Enter password'} />
              </div>
            ) : (
              <div className="border-t border-ds-line pt-4">
                <FormInput label="Resend API Key" type="password" value={resendCreds.apiKey} onChange={e => setResendCreds({ apiKey: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 're_...'} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <DsButton variant="primary" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              {hasConfig && editing && (
                <DsButton variant="default" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>
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
