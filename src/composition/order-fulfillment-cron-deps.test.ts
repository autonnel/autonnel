import { describe, it, expect, vi } from "vitest";

vi.mock("@/composition/make-commerce-gateway", () => ({
  makeReadFulfillmentService: async () => ({ readFulfillmentStatus: async () => ({}) }),
}));
vi.mock("@/lib/config/get-config", () => ({
  getConfig: async () => ({ credentials: { disableNotifications: true } }),
}));
vi.mock("@/composition/make-messaging", () => ({
  makeMessaging: () => ({ sendNotification: { send: vi.fn() } }),
}));

import { buildOrderFulfillmentCronDeps } from "./order-fulfillment-cron-deps";
import { realMessaging } from "./order-fulfillment-deps";

describe("buildOrderFulfillmentCronDeps", () => {
  it("wires the real messaging sender into the cron consumer (not a silently-dropping no-op)", async () => {
    const deps = await buildOrderFulfillmentCronDeps();
    expect(deps.messaging).toBe(realMessaging);
  });
});
