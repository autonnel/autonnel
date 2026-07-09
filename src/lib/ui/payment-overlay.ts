
const STYLE_ID = 'autonnel-payment-overlay-styles';
const MODAL_ID = 'payment-error-modal';
const OVERLAY_ID = 'processing-overlay';
const MESSAGE_ID = 'processing-message';

const DEFAULT_ERROR_MESSAGE =
  'Your payment could not be processed. Please check your card details and try again.';
const DEFAULT_PROCESSING_MESSAGE = 'Processing...';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = '@keyframes autonnel-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

function setStyle(el: HTMLElement, css: string): void {
  el.setAttribute('style', css);
}

function buildErrorModal(
  message: string,
  onRetry?: () => void,
  onCancel?: () => void,
): HTMLElement {
  const root = document.createElement('div');
  root.id = MODAL_ID;
  root.className = 'autonnel-payment-error';

  const backdrop = document.createElement('div');
  backdrop.className = 'autonnel-payment-error-backdrop';
  setStyle(
    backdrop,
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;',
  );

  const card = document.createElement('div');
  card.className = 'autonnel-payment-error-card';
  setStyle(
    card,
    'background:white;border-radius:16px;padding:32px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);',
  );

  const iconWrap = document.createElement('div');
  iconWrap.className = 'autonnel-payment-error-icon';
  setStyle(
    iconWrap,
    'width:64px;height:64px;border-radius:50%;background:#fef2f2;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;',
  );

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#dc2626');
  svg.setAttribute('stroke-width', '2');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  const line1 = document.createElementNS(SVG_NS, 'line');
  line1.setAttribute('x1', '12');
  line1.setAttribute('y1', '8');
  line1.setAttribute('x2', '12');
  line1.setAttribute('y2', '12');
  const line2 = document.createElementNS(SVG_NS, 'line');
  line2.setAttribute('x1', '12');
  line2.setAttribute('y1', '16');
  line2.setAttribute('x2', '12.01');
  line2.setAttribute('y2', '16');
  svg.appendChild(circle);
  svg.appendChild(line1);
  svg.appendChild(line2);
  iconWrap.appendChild(svg);

  const title = document.createElement('h3');
  title.className = 'autonnel-payment-error-title';
  setStyle(title, 'font-size:20px;font-weight:600;color:#111827;margin:0 0 12px;');
  title.textContent = 'Payment Failed';

  const desc = document.createElement('p');
  desc.className = 'autonnel-payment-error-message';
  setStyle(desc, 'color:#6b7280;font-size:15px;line-height:1.5;margin:0 0 24px;');
  desc.textContent = message;

  const actions = document.createElement('div');
  setStyle(actions, 'display:flex;gap:12px;justify-content:center;');

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'modal-close-btn';
  cancelBtn.type = 'button';
  cancelBtn.className = 'autonnel-payment-error-cancel';
  setStyle(
    cancelBtn,
    'padding:12px 24px;border-radius:8px;border:1px solid #d1d5db;background:white;font-size:14px;font-weight:500;color:#374151;cursor:pointer;',
  );
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    root.remove();
    onCancel?.();
  };

  const retryBtn = document.createElement('button');
  retryBtn.id = 'modal-retry-btn';
  retryBtn.type = 'button';
  retryBtn.className = 'autonnel-payment-error-retry';
  setStyle(
    retryBtn,
    'padding:12px 24px;border-radius:8px;border:none;background:#3b82f6;font-size:14px;font-weight:500;color:white;cursor:pointer;',
  );
  retryBtn.textContent = 'Try Again';
  retryBtn.onclick = () => {
    root.remove();
    onRetry?.();
  };

  actions.appendChild(cancelBtn);
  actions.appendChild(retryBtn);

  card.appendChild(iconWrap);
  card.appendChild(title);
  card.appendChild(desc);
  card.appendChild(actions);
  backdrop.appendChild(card);
  root.appendChild(backdrop);

  return root;
}

function buildProcessingOverlay(message: string): HTMLElement {
  const root = document.createElement('div');
  root.id = OVERLAY_ID;
  root.className = 'autonnel-processing-overlay';

  const backdrop = document.createElement('div');
  backdrop.className = 'autonnel-processing-backdrop';
  setStyle(
    backdrop,
    'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(4px);',
  );

  const card = document.createElement('div');
  card.className = 'autonnel-processing-card';
  setStyle(
    card,
    'background:white;border-radius:16px;padding:40px;max-width:400px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.3);',
  );

  const spinner = document.createElement('div');
  spinner.className = 'autonnel-processing-spinner';
  setStyle(
    spinner,
    'width:64px;height:64px;border:4px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;margin:0 auto 24px;animation:autonnel-spin 1s linear infinite;',
  );

  const title = document.createElement('h3');
  title.id = MESSAGE_ID;
  title.className = 'autonnel-processing-message';
  setStyle(title, 'font-size:18px;font-weight:600;color:#111827;margin:0 0 8px;');
  title.textContent = message;

  const desc = document.createElement('p');
  setStyle(desc, 'color:#6b7280;font-size:14px;margin:0;');
  desc.textContent = 'Please wait, do not close this page...';

  card.appendChild(spinner);
  card.appendChild(title);
  card.appendChild(desc);
  backdrop.appendChild(card);
  root.appendChild(backdrop);

  return root;
}

export function showPaymentError(
  message?: string,
  opts?: { onRetry?: () => void; onCancel?: () => void },
): void {
  ensureStyles();
  document.getElementById(MODAL_ID)?.remove();
  const node = buildErrorModal(message || DEFAULT_ERROR_MESSAGE, opts?.onRetry, opts?.onCancel);
  document.body.appendChild(node);
}

export function hidePaymentError(): void {
  document.getElementById(MODAL_ID)?.remove();
}

export function isPaymentErrorOpen(): boolean {
  return document.getElementById(MODAL_ID) !== null;
}

export function showProcessingOverlay(message: string = DEFAULT_PROCESSING_MESSAGE): void {
  ensureStyles();
  document.getElementById(OVERLAY_ID)?.remove();
  const node = buildProcessingOverlay(message);
  document.body.appendChild(node);
}

export function updateProcessingOverlay(message: string): void {
  const el = document.getElementById(MESSAGE_ID);
  if (el) el.textContent = message;
}

export function hideProcessingOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}
