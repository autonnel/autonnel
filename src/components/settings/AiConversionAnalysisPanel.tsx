import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '@/components/primitives/ds';
import { AlertBox, FormInput, Textarea } from '@/components/primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

const MIN = 30;
const MAX = 1440;
const STEP = 30;

interface LastResult {
  runAt: string;
  timeRange: string;
  sessionsAnalyzed: number;
  summary: string;
  analysis: string;
  hasLlmInsights: boolean;
}

export interface AiConversionAnalysisInitial {
  prompt: string;
  frequencyMinutes: number;
  lastResult: LastResult | null;
  hasConfig: boolean;
}

interface Props {
  initial: AiConversionAnalysisInitial;
}

function formatFrequency(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? 'Every 1h' : `Every ${hours}h`;
  }
  return `Every ${minutes} min`;
}

export default function AiConversionAnalysisPanel({ initial }: Props) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [frequency, setFrequency] = useState<number>(initial.frequencyMinutes);
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const last = initial.lastResult;

  const showForm = !hasConfig || editing;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiCall('PUT /api/settings/ai-conversion-analysis', {
        prompt: prompt.length === 0 ? null : prompt,
        frequencyMinutes: frequency,
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
    if (!window.confirm('Disable AI conversion analysis? The schedule and prompt will be cleared.')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('DELETE /api/settings/ai-conversion-analysis', null);
      setPrompt('');
      setFrequency(120);
      setHasConfig(false);
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const handleFrequencyBlur = () => {
    let v = frequency;
    if (!Number.isFinite(v) || Number.isNaN(v)) v = 120;
    if (v < MIN) v = MIN;
    if (v > MAX) v = MAX;
    setFrequency(Math.round(v));
  };

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'Status', value: 'Enabled' },
    { label: 'Frequency', value: formatFrequency(frequency) },
    { label: 'Custom prompt', value: prompt.length > 0 ? 'Set' : 'Default' },
  ];

  return (
    <div className="flex flex-col gap-6">
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">AI Conversion Analysis</span>
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
            <div>
              <div className="text-[13px] font-semibold text-ds-ink">AI Conversion Analysis</div>
              <div className="text-[12px] text-ds-muted mt-0.5">
                Periodically collects recent data, analyzes it with the LLM, and publishes the result as an event.
                Configure pairings in <a href="/settings/notifications" className="underline">Notifications</a> to receive it.
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ds-ink">Prompt (optional)</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Leave blank to use the default prompt"
              />
            </div>

            <FormInput
              label="Frequency (minutes)"
              type="number"
              min={MIN}
              max={MAX}
              step={STEP}
              value={frequency}
              onChange={(e) => setFrequency(parseInt(e.target.value, 10) || 0)}
              onBlur={handleFrequencyBlur}
              hint="Range: 30 min – 24 h"
            />

            <div className="flex items-center gap-3">
              <DsButton variant="primary" onClick={handleSave} disabled={saving || removing}>
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

      <DsCard>
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-[13px] font-semibold text-ds-ink">
              {last ? `Last run · ${new Date(last.runAt).toLocaleString()}` : 'Not run yet'}
            </div>
            {last && (
              <div className="text-[12px] text-ds-muted mt-0.5">
                Time range: {last.timeRange} · Sessions analyzed: {last.sessionsAnalyzed} ·{' '}
                {last.hasLlmInsights ? 'LLM insights included' : 'No LLM insights'}
              </div>
            )}
          </div>

          {last && (
            <>
              <details>
                <summary className="text-[12.5px] text-ds-ink cursor-pointer">Summary</summary>
                <pre className="text-[11.5px] text-ds-ink whitespace-pre-wrap break-words mt-2">{last.summary}</pre>
              </details>
              {last.analysis && (
                <details>
                  <summary className="text-[12.5px] text-ds-ink cursor-pointer">Analysis</summary>
                  <pre className="text-[11.5px] text-ds-ink whitespace-pre-wrap break-words mt-2">{last.analysis}</pre>
                </details>
              )}
            </>
          )}
        </div>
      </DsCard>
    </div>
  );
}
