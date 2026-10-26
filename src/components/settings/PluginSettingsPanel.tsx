import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, AlertBox, Switch, Label } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { PluginJobRow, PluginSettingsWire } from '@/contracts/settings';
import type { PluginSettingsValues } from '@/lib/plugins/types';

interface Props {
  initial: PluginSettingsWire;
}

const JOB_TONE: Record<string, 'ok' | 'warn' | 'bad' | 'muted'> = {
  SUCCEEDED: 'ok',
  PENDING: 'warn',
  RUNNING: 'warn',
  FAILED: 'bad',
  CANCELLED: 'muted',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiCallError || err instanceof Error ? err.message : fallback;
}

function formatValue(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  return value || '-';
}

function JobLog({ jobs }: { jobs: PluginJobRow[] }) {
  return (
    <DsCard>
      <div className="flex flex-col gap-3">
        <span className="text-[13.5px] font-semibold text-ds-ink">Recent deliveries</span>
        {jobs.length === 0 ? (
          <span className="text-[12.5px] text-ds-muted">No deliveries yet.</span>
        ) : (
          <table className="w-full text-[12.5px]" data-testid="plugin-job-log">
            <thead>
              <tr className="text-left text-[11.5px] uppercase tracking-wide text-ds-muted">
                <th className="py-1.5 pr-3 font-medium">Created</th>
                <th className="py-1.5 pr-3 font-medium">Delivery</th>
                <th className="py-1.5 pr-3 font-medium">Status</th>
                <th className="py-1.5 pr-3 font-medium">Attempts</th>
                <th className="py-1.5 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-ds-line align-top">
                  <td className="py-1.5 pr-3 whitespace-nowrap text-ds-muted">{new Date(job.createdAt).toLocaleString()}</td>
                  <td className="py-1.5 pr-3 break-all text-ds-text">{job.label ?? job.id}</td>
                  <td className="py-1.5 pr-3"><DsBadge tone={JOB_TONE[job.status] ?? 'default'}>{job.status}</DsBadge></td>
                  <td className="py-1.5 pr-3 text-ds-text">{job.attemptCount}/{job.maxAttempts}</td>
                  <td className="py-1.5 break-all text-ds-muted">{job.failureReason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </DsCard>
  );
}

export default function PluginSettingsPanel({ initial }: Props) {
  const [wire, setWire] = useState(initial);
  const [draft, setDraft] = useState<PluginSettingsValues>(initial.values);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { panel } = wire;
  const showForm = !wire.hasConfig || editing;
  const params = { panelId: panel.id };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await apiCall('PUT /api/settings/plugins/:panelId', { values: draft }, { params });
      setWire(next);
      setDraft(next.values);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(errorMessage(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove the ${panel.title} configuration?`)) return;
    setRemoving(true);
    setError(null);
    try {
      const next = await apiCall('DELETE /api/settings/plugins/:panelId', null, { params });
      setWire(next);
      setDraft(next.values);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, 'Remove failed'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5" data-testid="plugin-settings-panel">
      {panel.description && <div className="text-[12.5px] text-ds-muted">{panel.description}</div>}
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">{panel.title}</span>
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
              {panel.fields.map((field) => (
                <div key={field.key} className="flex flex-col gap-0.5">
                  <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">{field.label}</dt>
                  <dd className="text-[13px] text-ds-text break-all" data-field={field.key}>{formatValue(wire.values[field.key])}</dd>
                </div>
              ))}
            </dl>
          </div>
        </DsCard>
      ) : (
        <DsCard>
          <div className="flex flex-col gap-4">
            {panel.fields.map((field) =>
              field.type === 'toggle' ? (
                <div key={field.key} className="flex items-start gap-3">
                  <Switch
                    id={`field-${field.key}`}
                    checked={draft[field.key] === true}
                    onCheckedChange={(checked) => setDraft((d) => ({ ...d, [field.key]: checked }))}
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                    {field.help && <span className="text-[12px] text-ds-muted">{field.help}</span>}
                  </div>
                </div>
              ) : (
                <FormInput
                  key={field.key}
                  id={`field-${field.key}`}
                  label={field.required ? `${field.label} *` : field.label}
                  type={field.type === 'url' ? 'url' : 'text'}
                  value={String(draft[field.key] ?? '')}
                  placeholder={field.placeholder}
                  hint={field.help}
                  onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                />
              ),
            )}
            <div className="flex items-center gap-3 pt-2">
              <DsButton variant="primary" onClick={handleSave} disabled={saving || removing}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              {wire.hasConfig && editing && (
                <DsButton
                  variant="default"
                  onClick={() => { setEditing(false); setError(null); setDraft(wire.values); }}
                  disabled={saving}
                >
                  Cancel
                </DsButton>
              )}
              {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
            </div>
          </div>
        </DsCard>
      )}

      {(wire.jobs.length > 0 || wire.hasConfig) && <JobLog jobs={wire.jobs} />}
    </div>
  );
}
