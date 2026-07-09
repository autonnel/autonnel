import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton } from '../../primitives/ds';
import { FormInput, FormSelect, AlertBox } from '../../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';
import type { PaymentFormFieldSpec } from '@/lib/adapters/payment/registry';

interface ExistingConfig {
  mode: string;
  values?: Record<string, string>;
}

interface Props {
  providerId: string;
  displayName: string;
  formFields: PaymentFormFieldSpec[];
  existing: ExistingConfig | null;
}

export default function PaymentProviderForm({
  providerId,
  displayName,
  formFields,
  existing,
}: Props) {
  const [mode, setMode] = useState<string>(existing?.mode || 'sandbox');
  const initialValues: Record<string, string> = {};
  for (const field of formFields) {
    initialValues[field.key] = existing?.values?.[field.key] ?? '';
  }
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = providerId.toLowerCase();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const credentials: Record<string, string> = {};
      for (const field of formFields) {
        if (values[field.key]) credentials[field.key] = values[field.key];
      }
      await apiCall('PUT /api/settings/payment/:provider', {
        credentials,
        settings: { mode },
        isActive: true,
      }, { params: { provider } });
      window.location.href = '/payment';
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove ${displayName} configuration?`)) return;
    try {
      await apiCall('DELETE /api/settings/payment/:provider', null, { params: { provider } });
      window.location.href = '/payment';
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <AlertBox type="error">{error}</AlertBox>}

      <FormSelect
        label="Mode"
        value={mode}
        onChange={(e) => setMode(e.target.value)}
      >
        <option value="sandbox">Sandbox / Test</option>
        <option value="live">Live</option>
      </FormSelect>

      {formFields.map((field) => (
        <FormInput
          key={field.key}
          label={field.label}
          type={field.type}
          value={values[field.key]}
          placeholder={field.placeholder || (existing ? 'Leave blank to keep' : '')}
          hint={field.hint}
          onChange={(e) =>
            setValues({ ...values, [field.key]: e.target.value })
          }
        />
      ))}

      <div className="flex items-center gap-3 pt-2">
        <DsButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save
        </DsButton>
        <a href="/payment" className="text-[13px] text-ds-muted hover:text-ds-ink">
          Cancel
        </a>
        {existing && (
          <DsButton
            variant="default"
            onClick={handleRemove}
            disabled={saving}
            className="ml-auto"
          >
            Remove
          </DsButton>
        )}
      </div>
    </div>
  );
}
