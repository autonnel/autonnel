export interface ProviderErrorSignal {
  httpStatus?: number;
  network?: boolean;
  hardBounce?: boolean;
}

export class RetryPolicy {
  isTransient(signal: ProviderErrorSignal): boolean {
    if (signal.hardBounce) return false;
    if (signal.network) return true;
    const s = signal.httpStatus ?? 0;
    if (s === 429) return true;
    if (s >= 500) return true;
    if (s >= 400) return false;
    return false;
  }
}
