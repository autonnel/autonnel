import { describe, it, expect } from "vitest";
import type {
  OrderRepositoryPort,
  BackendFulfillmentReaderPort,
  MessagingPort,
  JobSchedulerPort,
  DomainEventPublisherPort,
  OrderQueryPort,
} from "./ports";

describe("Order & Fulfillment ports", () => {
  it("compose into a usable structural shape", () => {
    const repo: OrderRepositoryPort = {
      findBySaleRef: async () => null,
      findById: async () => null,
      findPaidWithBackendRef: async () => ({ orders: [], nextCursor: null }),
      save: async () => {},
    };
    const reader: BackendFulfillmentReaderPort = {
      readFulfillment: async () => ({ status: "unknown", tracking: undefined }),
    };
    const messaging: MessagingPort = { send: async () => {} };
    const scheduler: JobSchedulerPort = { register: () => {} };
    const publisher: DomainEventPublisherPort = { publishAll: async () => {} };
    const query: OrderQueryPort = repo as unknown as OrderQueryPort;
    expect([repo, reader, messaging, scheduler, publisher, query].every(Boolean)).toBe(true);
  });
});
