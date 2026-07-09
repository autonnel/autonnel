import React from 'react';
import { Button, Input, Label, LoadingSpinner, Radio, Switch } from '../primitives';
import { Save, X, Percent, Calendar, ShieldCheck, Tag } from 'lucide-react';

export interface CouponFormData {
  name: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number | null;
  maxUsages: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

type DiscountKind = 'PERCENTAGE' | 'FIXED_AMOUNT';

interface CouponFormProps {
  initialData?: {
    name: string;
    code: string;
    discountType: DiscountKind;
    discountValue: string;
    minOrderAmount: string | null;
    maxUsages: number | null;
    isActive: boolean;
    expiresAt: string | null;
  } | null;
  saving: boolean;
  onSubmit: (data: CouponFormData) => void;
  onCancel: () => void;
}

const CODE_RE = /^[A-Z0-9_-]+$/;

const SECTION_BOX = 'rounded-lg border border-border p-4';
const SECTION_LEGEND = 'flex items-center gap-2 px-1 text-sm font-medium text-foreground';
const ICON_CLASS = 'h-4 w-4 text-muted-foreground';
const RADIO_BASE =
  'flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 text-sm transition-colors';

const toMoneyString = (raw: string | null | undefined): string =>
  raw ? parseFloat(raw).toString() : '';

const toLocalDateTime = (raw: string | null | undefined): string =>
  raw ? new Date(raw).toISOString().slice(0, 16) : '';

const niceDate = (raw: string): string => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const ErrorLine: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="text-sm text-destructive mt-1">{message}</p> : null;

const Panel: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <fieldset className={SECTION_BOX}>
    <legend className={SECTION_LEGEND}>
      {icon}
      {title}
    </legend>
    <div className="mt-2 space-y-3">{children}</div>
  </fieldset>
);

export default function CouponForm({ initialData, saving, onSubmit, onCancel }: CouponFormProps) {
  const [fields, setFields] = React.useState(() => ({
    name: initialData?.name || '',
    code: initialData?.code || '',
    discountType: (initialData?.discountType || 'PERCENTAGE') as DiscountKind,
    discountValue: toMoneyString(initialData?.discountValue),
    minOrderAmount: toMoneyString(initialData?.minOrderAmount),
    maxUsages: initialData?.maxUsages?.toString() || '',
    expiresAt: toLocalDateTime(initialData?.expiresAt),
    isActive: initialData?.isActive ?? true,
  }));
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const patch = <K extends keyof typeof fields>(key: K, value: (typeof fields)[K]) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const { name, code, discountType, discountValue, minOrderAmount, maxUsages, expiresAt, isActive } =
    fields;

  const collectErrors = (): Record<string, string> => {
    const found: Record<string, string> = {};

    if (!name.trim()) found.name = 'Name is required';
    if (!code.trim()) found.code = 'Code is required';
    if (!CODE_RE.test(code.toUpperCase().trim())) {
      found.code = 'Code must contain only letters, numbers, hyphens, and underscores';
    }

    const value = parseFloat(discountValue);
    if (!discountValue || isNaN(value) || value <= 0) {
      found.discountValue = 'Value must be greater than 0';
    }
    if (discountType === 'PERCENTAGE' && value > 100) {
      found.discountValue = 'Percentage cannot exceed 100';
    }

    if (minOrderAmount) {
      const m = parseFloat(minOrderAmount);
      if (isNaN(m) || m < 0) found.minOrderAmount = 'Must be a valid amount';
    }

    if (maxUsages) {
      const u = parseInt(maxUsages, 10);
      if (isNaN(u) || u < 1) found.maxUsages = 'Must be at least 1';
    }

    return found;
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const found = collectErrors();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      discountType,
      discountValue: parseFloat(discountValue),
      minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
      maxUsages: maxUsages ? parseInt(maxUsages, 10) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      isActive,
    });
  };

  const parsedValue = parseFloat(discountValue);
  const showValue = Boolean(discountValue) && !Number.isNaN(parsedValue) && parsedValue > 0;
  const discountSummary = !showValue
    ? 'No discount set'
    : discountType === 'PERCENTAGE'
      ? `${parsedValue}% off`
      : `$${parsedValue.toFixed(2)} off`;

  const parsedMin = parseFloat(minOrderAmount);
  const showMin = Boolean(minOrderAmount) && !Number.isNaN(parsedMin) && parsedMin >= 0;

  const radioClass = (kind: DiscountKind) =>
    `${RADIO_BASE} ${discountType === kind ? 'border-primary bg-primary/5' : 'border-border'}`;

  return (
    <form
      noValidate
      onSubmit={submit}
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]"
      data-autonnel-settings="coupon-form"
    >
      <div className="space-y-4 min-w-0">
        <Panel icon={<Tag className={ICON_CLASS} />} title="Basics">
          <div>
            <Label htmlFor="coupon-name">Name</Label>
            <Input
              id="coupon-name"
              value={name}
              onChange={(e) => patch('name', e.target.value)}
              placeholder='e.g., "Welcome 10% Off"'
              className="mt-1.5"
            />
            <ErrorLine message={errors.name} />
          </div>
          <div>
            <Label htmlFor="coupon-code">Code</Label>
            <Input
              id="coupon-code"
              value={code}
              onChange={(e) => patch('code', e.target.value.toUpperCase())}
              placeholder="e.g., WELCOME10"
              className="mt-1.5 font-mono"
            />
            <ErrorLine message={errors.code} />
          </div>
        </Panel>

        <Panel icon={<Percent className={ICON_CLASS} />} title="Discount">
          <div>
            <Label>Type</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <label className={radioClass('PERCENTAGE')}>
                <Radio
                  name="discountType"
                  value="PERCENTAGE"
                  checked={discountType === 'PERCENTAGE'}
                  onChange={() => patch('discountType', 'PERCENTAGE')}
                  className="shrink-0"
                />
                <span className="truncate">Percentage</span>
              </label>
              <label className={radioClass('FIXED_AMOUNT')}>
                <Radio
                  name="discountType"
                  value="FIXED_AMOUNT"
                  checked={discountType === 'FIXED_AMOUNT'}
                  onChange={() => patch('discountType', 'FIXED_AMOUNT')}
                  className="shrink-0"
                />
                <span className="truncate">Fixed Amount</span>
              </label>
            </div>
          </div>
          <div>
            <Label htmlFor="coupon-value">Value</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {discountType === 'PERCENTAGE' ? '%' : '$'}
              </span>
              <Input
                id="coupon-value"
                type="number"
                step={discountType === 'PERCENTAGE' ? '1' : '0.01'}
                min="0"
                max={discountType === 'PERCENTAGE' ? '100' : undefined}
                value={discountValue}
                onChange={(e) => patch('discountValue', e.target.value)}
                placeholder={discountType === 'PERCENTAGE' ? '10' : '5.00'}
                className="pl-8"
              />
            </div>
            <ErrorLine message={errors.discountValue} />
          </div>
        </Panel>

        <Panel icon={<ShieldCheck className={ICON_CLASS} />} title="Restrictions">
          <div className="space-y-3">
            <div>
              <Label htmlFor="coupon-min-order">Minimum Order Amount</Label>
              <Input
                id="coupon-min-order"
                type="number"
                step="0.01"
                min="0"
                value={minOrderAmount}
                onChange={(e) => patch('minOrderAmount', e.target.value)}
                placeholder="No minimum"
                className="mt-1.5"
              />
              <ErrorLine message={errors.minOrderAmount} />
            </div>
            <div>
              <Label htmlFor="coupon-max-usages">Maximum Usages</Label>
              <Input
                id="coupon-max-usages"
                type="number"
                step="1"
                min="1"
                value={maxUsages}
                onChange={(e) => patch('maxUsages', e.target.value)}
                placeholder="Unlimited"
                className="mt-1.5"
              />
              <ErrorLine message={errors.maxUsages} />
            </div>
          </div>
        </Panel>

        <Panel icon={<Calendar className={ICON_CLASS} />} title="Schedule">
          <div>
            <Label htmlFor="coupon-expires">Expiration Date</Label>
            <Input
              id="coupon-expires"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => patch('expiresAt', e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="flex items-center justify-between gap-4 pt-1">
            <div>
              <Label>Active</Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Only active coupons can be applied to orders
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(v) => patch('isActive', v)}
            />
          </div>
        </Panel>
      </div>

      <aside className="lg:row-start-1 lg:col-start-2">
        <div
          className="rounded-lg border border-dashed border-border bg-muted/30 p-4"
          data-autonnel-settings="coupon-preview"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <p className="mt-3 font-mono text-lg font-semibold">
            {code.trim() ? code.toUpperCase() : 'CODE'}
          </p>
          <p className="mt-1 text-sm text-foreground">{discountSummary}</p>
          {name.trim() && <p className="mt-2 text-sm text-muted-foreground">{name.trim()}</p>}
          {showMin && (
            <p className="mt-2 text-xs text-muted-foreground">min ${parsedMin.toFixed(2)}</p>
          )}
          {expiresAt && (
            <p className="mt-1 text-xs text-muted-foreground">Expires {niceDate(expiresAt)}</p>
          )}
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isActive ? 'bg-primary' : 'bg-muted-foreground'
              }`}
            />
            {isActive ? 'Active' : 'Inactive'}
          </p>
        </div>
      </aside>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4 lg:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-1 h-4 w-4" />
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <LoadingSpinner size="sm" className="mr-2" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {initialData ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
