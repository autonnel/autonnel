export type TrackedOrderStatusKey =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export interface TrackedOrderItemView {
  externalRef: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface TrackedOrderView {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  capturedTotalMinor: number;
  currencyCode: string;
  customerName: string | null;
  items: TrackedOrderItemView[];
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingUrl: string | null;
}

export interface CustomerOrderTrackingReadPort {
  byEmailAndNumber(email: string, orderNumber: string): Promise<TrackedOrderView | null>;
}

export const TRACKABLE_STATUSES: TrackedOrderStatusKey[] = [
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export class CustomerOrderTrackingService {
  constructor(private readonly orders: CustomerOrderTrackingReadPort) {}

  // Email + order number must BOTH match: email alone must never enumerate a customer's orders/PII.
  async track(email: string, orderNumber: string): Promise<TrackedOrderView | null> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) throw new InvalidTrackingEmailError();
    const normalizedNumber = orderNumber.trim();
    if (!normalizedNumber) return null;
    return this.orders.byEmailAndNumber(normalizedEmail, normalizedNumber);
  }
}

export class InvalidTrackingEmailError extends Error {
  constructor() {
    super("Invalid email format");
    this.name = "InvalidTrackingEmailError";
  }
}
