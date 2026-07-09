import { apiCall } from '@/lib/api/client';

const root = document.getElementById('order-actions');
const orderId = root?.dataset.orderId ?? '';

function notify(tone: 'success' | 'error', message: string) {
  const t = (window as unknown as { __autonnelToast?: Record<string, (m: string) => void> }).__autonnelToast;
  if (t && typeof t[tone] === 'function') t[tone](message);
  else console.warn(`[autonnel] toast(${tone}): ${message}`);
}
function attach(action: string, handler: () => void) {
  const btn = document.querySelector(`[data-action="${action}"]`);
  if (btn) btn.addEventListener('click', handler);
}
attach('resync', async () => {
  try {
    await apiCall('POST /api/order/:orderId/resync', null, { params: { orderId } });
    location.reload();
  } catch {
    notify('error', 'Failed to resync.');
  }
});
attach('resend-email', async () => {
  if (!confirm('Resend the order confirmation email?')) return;
  try {
    await apiCall('POST /api/order/:orderId/requeue', { email: true, postbacks: false }, { params: { orderId } });
    notify('success', 'Confirmation email re-queued.');
  } catch {
    notify('error', 'Failed to queue email.');
  }
});
attach('save-note', async () => {
  const ta = document.getElementById('order-note') as HTMLTextAreaElement | null;
  try {
    await apiCall('PUT /api/order/:orderId/note', { note: ta?.value || null }, { params: { orderId } });
    notify('success', 'Note saved.');
  } catch {
    notify('error', 'Failed to save note.');
  }
});

// One form per charge: each refunds a single underlying charge (data-charge-ref), capped at its
// remaining balance, so a merged-upsell order's charges can be refunded independently.
document.querySelectorAll('form.refund-form').forEach((el) => {
  const refundForm = el as HTMLFormElement;
  const kindSel = refundForm.querySelector('.rf-kind') as HTMLSelectElement | null;
  const fixedRow = refundForm.querySelector<HTMLElement>('.rf-fixed');
  const pctRow = refundForm.querySelector<HTMLElement>('.rf-percentage');
  const syncKind = () => {
    const k = kindSel?.value;
    if (fixedRow) fixedRow.hidden = k !== 'fixed';
    if (pctRow) pctRow.hidden = k !== 'percentage';
  };
  kindSel?.addEventListener('change', syncKind);
  syncKind();

  refundForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const intentId = refundForm.dataset.intentId ?? '';
    const chargeRef = refundForm.dataset.chargeRef || undefined;
    const currency = refundForm.dataset.currency ?? 'USD';
    const kind = kindSel?.value ?? 'full';
    const reason = (refundForm.querySelector<HTMLTextAreaElement>('.rf-reason')?.value || '').trim() || undefined;

    const input: {
      intentId: string;
      kind: 'full' | 'fixed' | 'percentage';
      currencyCode: string;
      chargeRef?: string;
      fixedAmountMinor?: number;
      percentage?: number;
      reason?: string;
    } = { intentId, kind: kind as 'full' | 'fixed' | 'percentage', currencyCode: currency, chargeRef, reason };

    if (kind === 'fixed') {
      const major = parseFloat(refundForm.querySelector<HTMLInputElement>('.rf-amount')?.value || '');
      if (!Number.isFinite(major) || major <= 0) { notify('error', 'Enter a valid refund amount.'); return; }
      input.fixedAmountMinor = Math.round(major * 100);
    } else if (kind === 'percentage') {
      const pct = parseInt(refundForm.querySelector<HTMLInputElement>('.rf-pct')?.value || '', 10);
      if (!Number.isInteger(pct) || pct < 1 || pct > 100) { notify('error', 'Enter a percentage between 1 and 100.'); return; }
      input.percentage = pct;
    }

    if (!confirm('Issue this refund? This charges the payment provider and cannot be undone.')) return;
    const btn = refundForm.querySelector<HTMLButtonElement>('.rf-submit');
    if (btn) btn.disabled = true;
    try {
      const out = await apiCall('POST /api/order/:orderId/refund', input, { params: { orderId } });
      notify('success', `Refunded ${(out.refundedAmountMinor / 100).toFixed(2)} ${currency}.`);
      location.reload();
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Refund failed.');
      if (btn) btn.disabled = false;
    }
  });
});
