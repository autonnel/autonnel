import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard } from '../primitives/ds';
import { AlertBox, dsSelectClass } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from '@/lib/constants/timezone';

interface LocalizationPanelInitial {
  timezone: string;
}

interface LocalizationPanelProps {
  initial: LocalizationPanelInitial;
}

export default function LocalizationPanel({ initial }: LocalizationPanelProps) {
  const [timezone, setTimezone] = useState(initial.timezone || DEFAULT_TIMEZONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await apiCall('PUT /api/settings/localization', { timezone });
      setTimezone(data.timezone);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        The default timezone applied across the dashboard — analytics windows, order timestamps, and dates
        shown in transactional emails. Times are stored in UTC and displayed in this zone.
      </div>
      {error && <AlertBox type="error">{error}</AlertBox>}

      <DsCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 max-w-[280px]">
            <label className="text-[11.5px] font-medium text-ds-muted uppercase tracking-wide" htmlFor="tz">
              Timezone
            </label>
            <select
              id="tz"
              className={dsSelectClass}
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <DsButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </DsButton>
            {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
          </div>
        </div>
      </DsCard>
    </div>
  );
}
