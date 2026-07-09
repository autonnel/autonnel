import { CaptureResult } from './value-objects';

export const CaptureSource = { WEBHOOK: 'WEBHOOK', SYNC: 'SYNC' } as const;
export type CaptureSource = (typeof CaptureSource)[keyof typeof CaptureSource];

export interface ReconcileInput {
  existing: CaptureResult | undefined;
  incoming: CaptureResult;
  source: CaptureSource;
}

export interface ReconcileOutcome {
  shouldApply: boolean;
  authoritative: boolean;
}

export class CaptureResultReconciler {
  reconcile(input: ReconcileInput): ReconcileOutcome {
    const { existing, incoming, source } = input;
    if (existing && existing.providerChargeId === incoming.providerChargeId) {
      return { shouldApply: false, authoritative: source === CaptureSource.WEBHOOK };
    }
    return { shouldApply: true, authoritative: source === CaptureSource.WEBHOOK };
  }
}
