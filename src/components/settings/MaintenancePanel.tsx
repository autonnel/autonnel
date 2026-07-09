import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard } from '../primitives/ds';
import { FormInput, AlertBox, Checkbox, Textarea, dsFieldLabelClass } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { MaintenancePatchResult } from '@/contracts/settings';

interface MaintenancePanelInitial {
  enabled: boolean;
  message: string;
  hasPassword: boolean;
  canEdit: boolean;
  tooltip: string | null;
}

interface MaintenancePanelProps {
  initial: MaintenancePanelInitial;
}

export default function MaintenancePanel({ initial }: MaintenancePanelProps) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [password, setPassword] = useState('');
  const [hasPassword, setHasPassword] = useState(initial.hasPassword);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const disabled = !initial.canEdit;

  const submit = async (overrides: {
    enabled?: boolean;
    message?: string | null;
    password?: string;
    clearPassword?: boolean;
  }): Promise<MaintenancePatchResult> => {
    setError(null);
    return apiCall('PATCH /api/settings/maintenance', overrides);
  };

  const handleSave = async () => {
    if (password && password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    setSaving(true);
    try {
      const result = await submit({
        ...(disabled ? {} : { enabled }),
        message,
        ...(password ? { password } : {}),
      });
      setEnabled(result.enabled);
      setMessage(result.message);
      setHasPassword(result.hasPassword);
      setPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearPassword = async () => {
    setClearing(true);
    try {
      const result = await submit({ clearPassword: true });
      setHasPassword(result.hasPassword);
      setPassword('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Temporarily block storefront traffic. Admin pages remain accessible.
      </div>
      {error && <AlertBox type="error">{error}</AlertBox>}
      <DsCard>
        <div className="flex flex-col gap-5">
          <label
            className="flex items-center gap-3"
            title={disabled ? initial.tooltip ?? undefined : undefined}
          >
            <Checkbox
              checked={enabled}
              disabled={disabled}
              onChange={(e) => setEnabled(e.target.checked)}
              data-testid="maintenance-enabled-toggle"
              aria-describedby={disabled ? 'maintenance-toggle-tooltip' : undefined}
              title={disabled ? initial.tooltip ?? undefined : undefined}
            />
            <span className="text-[13px] text-ds-ink">
              Enable maintenance mode
            </span>
            {disabled && initial.tooltip && (
              <span id="maintenance-toggle-tooltip" className="sr-only">
                {initial.tooltip}
              </span>
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <label className={dsFieldLabelClass}>
              Message shown to visitors (optional)
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          <FormInput
            label={hasPassword ? 'Set new password (leave blank to keep)' : 'Bypass password (optional)'}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Bypass password"
            minLength={4}
            hint="At least 4 characters"
          />
          {hasPassword && (
            <div className="text-[12px] text-ds-muted">
              A bypass password is currently set. Visitors who enter it can access the storefront.
            </div>
          )}
          {!hasPassword && (
            <div className="text-[12px] text-ds-muted">
              No bypass password is set; the storefront is fully blocked while maintenance is on.
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <DsButton variant="primary" onClick={handleSave} disabled={saving || clearing}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </DsButton>
            {hasPassword && (
              <DsButton variant="default" onClick={handleClearPassword} disabled={saving || clearing}>
                {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
                Clear password
              </DsButton>
            )}
            {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
          </div>
        </div>
      </DsCard>
    </div>
  );
}
