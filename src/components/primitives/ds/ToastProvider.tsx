import * as React from 'react';
import Toast, { type ToastItem, type ToastTone } from './Toast';

export interface ToastOptions {
  description?: string;
  durationMs?: number;
  dismissible?: boolean;
}

export interface ToastApi {
  show(tone: ToastTone, message: string, opts?: ToastOptions): string;
  success(message: string, opts?: ToastOptions): string;
  error(message: string, opts?: ToastOptions): string;
  info(message: string, opts?: ToastOptions): string;
  warn(message: string, opts?: ToastOptions): string;
  dismiss(id: string): void;
  clear(): void;
}

export const DEFAULT_DURATION_MS = 4000;
export const MAX_TOASTS = 5;

type Listener = (items: ToastItem[]) => void;

class ToastStore {
  private items: ToastItem[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  getSnapshot = (): ToastItem[] => this.items;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    for (const listener of this.listeners) listener(this.items);
  }

  show(tone: ToastTone, message: string, opts: ToastOptions = {}): string {
    const id = `t${this.nextId++}`;
    const isError = tone === 'error';
    const autoDismissMs =
      opts.durationMs === undefined
        ? isError
          ? null
          : DEFAULT_DURATION_MS
        : opts.durationMs > 0
          ? opts.durationMs
          : null;
    const item: ToastItem = {
      id,
      tone,
      message,
      description: opts.description,
      createdAt: Date.now(),
      dismissible: opts.dismissible !== false,
      autoDismissMs,
    };
    this.items = [...this.items, item].slice(-MAX_TOASTS);
    if (autoDismissMs !== null) {
      const timer = setTimeout(() => this.dismiss(id), autoDismissMs);
      this.timers.set(id, timer);
    }
    this.emit();
    return id;
  }

  dismiss = (id: string): void => {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
    const before = this.items.length;
    this.items = this.items.filter((i) => i.id !== id);
    if (this.items.length !== before) this.emit();
  };

  clear = (): void => {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    if (this.items.length > 0) {
      this.items = [];
      this.emit();
    }
  };
}

export const toastStore = new ToastStore();

export const toast: ToastApi = {
  show: (tone, message, opts) => toastStore.show(tone, message, opts),
  success: (message, opts) => toastStore.show('success', message, opts),
  error: (message, opts) => toastStore.show('error', message, opts),
  info: (message, opts) => toastStore.show('info', message, opts),
  warn: (message, opts) => toastStore.show('warn', message, opts),
  dismiss: (id) => toastStore.dismiss(id),
  clear: () => toastStore.clear(),
};

if (typeof window !== 'undefined') {
  (window as any).__autonnelToast = toast;
}

const ToastProvider: React.FC = () => {
  const [items, setItems] = React.useState<ToastItem[]>(() => toastStore.getSnapshot());
  React.useEffect(() => toastStore.subscribe(setItems), []);
  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { transform: translateY(8px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none"
      >
        {items.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={toastStore.dismiss} />
        ))}
      </div>
    </>
  );
};

export default ToastProvider;
