export interface MaskableErrorEvent {
  message?: string | null;
  filename?: string | null;
  error?: unknown;
}

// Browsers replace cross-origin script errors with an opaque "Script error." — no
// filename, no stack, event.error === null — to avoid leaking other origins' internals.
// Those records are undiagnosable and dominated by browser extensions / ad blockers, so
// they must not inflate the first-party js_error count, activity feed, or notifications.
export function isMaskedCrossOriginError(event: MaskableErrorEvent): boolean {
  if (event.error) return false;
  const message = (event.message ?? '').trim();
  return /^script error\.?$/i.test(message) || !event.filename;
}
