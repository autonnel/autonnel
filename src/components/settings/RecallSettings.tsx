import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  LoadingSpinner,
  AlertBox,
} from '../primitives';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../primitives/Select';
import { Plus, Trash2, Save, Clock, ArrowDown } from 'lucide-react';
import RecallStats, { type RecallStatsData } from './RecallStats';
import { apiCall, ApiCallError } from '@/lib/api/client';

interface RecallInterval {
  hours: number;
  emailTemplateType: string;
  couponId?: string | null;
}

interface RecallConfigData {
  id?: string | null;
  isEnabled: boolean;
  intervals: RecallInterval[];
}

interface CouponOption {
  id: string;
  name: string;
  code: string;
}

interface RecallSettingsProps {
  initialConfig: {
    id: string | null;
    isEnabled: boolean;
    intervals: RecallInterval[];
  };
  initialCoupons: CouponOption[];
  initialStats: RecallStatsData;
}

const EMAIL_TEMPLATE_TYPES = [
  { value: 'RECALL_1', label: 'Recall 1 (First reminder)' },
  { value: 'RECALL_2', label: 'Recall 2 (Second reminder)' },
  { value: 'RECALL_3', label: 'Recall 3 (Final reminder)' },
];

const NO_COUPON = '__none__';
const MIN_HOURS = 1;
const MAX_HOURS = 8760;

function clampHours(value: number): number {
  if (!Number.isFinite(value)) return MIN_HOURS;
  const rounded = Math.round(value);
  if (rounded < MIN_HOURS) return MIN_HOURS;
  if (rounded > MAX_HOURS) return MAX_HOURS;
  return rounded;
}

function sortByHours(steps: RecallInterval[]): RecallInterval[] {
  return [...steps].sort((a, b) => a.hours - b.hours);
}

export default function RecallSettings({ initialConfig, initialCoupons, initialStats }: RecallSettingsProps) {
  const [config, setConfig] = useState<RecallConfigData>({
    id: initialConfig.id,
    isEnabled: initialConfig.isEnabled,
    intervals: sortByHours(initialConfig.intervals),
  });
  const [coupons] = useState<CouponOption[]>(initialCoupons);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const steps = config.intervals;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const data = await apiCall('PUT /api/settings/recall', {
        isEnabled: config.isEnabled,
        intervals: sortByHours(config.intervals).map((i) => ({
          hours: i.hours,
          emailTemplateType: i.emailTemplateType,
          couponId: i.couponId || null,
        })),
      });

      setConfig((prev) => ({ ...prev, id: data.id }));
      setSuccess('Recall configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const updateStep = (index: number, field: keyof RecallInterval, value: string | number | null) => {
    setConfig((prev) => {
      const next = prev.intervals.map((step, i) =>
        i === index ? { ...step, [field]: value } : step
      );
      return { ...prev, intervals: field === 'hours' ? sortByHours(next) : next };
    });
  };

  const addStep = () => {
    setConfig((prev) => {
      const nextHour = clampHours(Math.max(...prev.intervals.map((i) => i.hours), 0) + 72);
      return {
        ...prev,
        intervals: sortByHours([...prev.intervals, { hours: nextHour, emailTemplateType: 'RECALL_1' }]),
      };
    });
  };

  const removeStep = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      intervals: prev.intervals.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="space-y-6">
      {error && <AlertBox type="error" title="Error">{error}</AlertBox>}
      {success && <AlertBox type="success" title="Saved">{success}</AlertBox>}

      <RecallStats initialStats={initialStats} />

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Recall Sequence</Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                A timed drip of reminder emails sent after a cart is abandoned
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.isEnabled}
              onClick={() => setConfig((prev) => ({ ...prev, isEnabled: !prev.isEnabled }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                config.isEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  config.isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <ol className="relative space-y-0">
            {steps.map((step, index) => {
              const gap = index > 0 ? step.hours - steps[index - 1].hours : null;
              return (
                <li key={index} className="relative">
                  {gap !== null && (
                    <div
                      className="flex items-center gap-2 py-2 pl-4 text-xs text-muted-foreground"
                      data-testid="sequence-connector"
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>wait {gap}h</span>
                    </div>
                  )}

                  <div className="relative rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium">Step {index + 1}</span>
                      </div>
                      {steps.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remove step ${index + 1}`}
                          onClick={() => removeStep(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Send timing</Label>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                          <Input
                            type="number"
                            min={MIN_HOURS}
                            max={MAX_HOURS}
                            aria-label={`Step ${index + 1} hours after cart abandoned`}
                            value={step.hours}
                            onChange={(e) =>
                              updateStep(index, 'hours', clampHours(parseInt(e.target.value, 10)))
                            }
                            className="w-24"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{step.hours}h after cart abandoned</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Email template</Label>
                        <Select
                          value={step.emailTemplateType}
                          onValueChange={(value) => updateStep(index, 'emailTemplateType', value)}
                        >
                          <SelectTrigger aria-label={`Step ${index + 1} email template`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_TEMPLATE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Coupon</Label>
                        <Select
                          value={step.couponId || NO_COUPON}
                          onValueChange={(value) =>
                            updateStep(index, 'couponId', value === NO_COUPON ? null : value)
                          }
                        >
                          <SelectTrigger aria-label={`Step ${index + 1} coupon`}>
                            <SelectValue placeholder="No coupon" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NO_COUPON}>No coupon</SelectItem>
                            {coupons.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="w-4 h-4 mr-1" />
            Add step
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save sequence
        </Button>
      </div>
    </div>
  );
}
