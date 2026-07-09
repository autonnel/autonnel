// Autonnel-owned order number: prefix-free, time-sortable, numeric. The external commerce
// backend ref (Shopify GID etc.) is NOT the order number — it is attached later as backendOrderRef.
const EPOCH_2020 = 1577836800000; // 2020-01-01T00:00:00Z, keeps the number ~12 digits

export function generateOrderNumber(now: number = Date.now(), rand: number = Math.random()): string {
  const seconds = Math.floor((now - EPOCH_2020) / 1000);
  const suffix = Math.floor(rand * 1000)
    .toString()
    .padStart(3, '0');
  return `${seconds}${suffix}`;
}
