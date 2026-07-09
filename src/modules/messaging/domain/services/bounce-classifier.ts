import { DispatchStatus, SuppressionReason } from '../value-objects';

export enum ReceiptKind {
  DELIVERED = 'DELIVERED',
  HARD_BOUNCE = 'HARD_BOUNCE',
  SOFT_BOUNCE = 'SOFT_BOUNCE',
  COMPLAINT = 'COMPLAINT',
  OPENED = 'OPENED',
  CLICKED = 'CLICKED',
}

export interface ClassificationResult {
  transition?: DispatchStatus;
  suppress?: SuppressionReason;
  engaged?: boolean;
}

export class BounceClassifier {
  classify(kind: ReceiptKind): ClassificationResult {
    switch (kind) {
      case ReceiptKind.DELIVERED:
        return { transition: DispatchStatus.DELIVERED };
      case ReceiptKind.HARD_BOUNCE:
        return { transition: DispatchStatus.BOUNCED, suppress: SuppressionReason.HardBounce };
      case ReceiptKind.COMPLAINT:
        return { transition: DispatchStatus.COMPLAINED, suppress: SuppressionReason.Complaint };
      case ReceiptKind.OPENED:
      case ReceiptKind.CLICKED:
        return { engaged: true };
      case ReceiptKind.SOFT_BOUNCE:
      default:
        return {};
    }
  }
}
