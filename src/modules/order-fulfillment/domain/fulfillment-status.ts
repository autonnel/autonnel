export const FulfillmentStatus = {
  UNFULFILLED: "unfulfilled",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  UNKNOWN: "unknown",
} as const;

export type FulfillmentStatus =
  (typeof FulfillmentStatus)[keyof typeof FulfillmentStatus];

const MAP: Record<string, FulfillmentStatus> = {
  unfulfilled: FulfillmentStatus.UNFULFILLED,
  in_transit: FulfillmentStatus.IN_TRANSIT,
  delivered: FulfillmentStatus.DELIVERED,
};

export function normalizeFulfillment(raw: string | undefined): FulfillmentStatus {
  if (!raw) return FulfillmentStatus.UNKNOWN;
  return MAP[raw] ?? FulfillmentStatus.UNKNOWN;
}
