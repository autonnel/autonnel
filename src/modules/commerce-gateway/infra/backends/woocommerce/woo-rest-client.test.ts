import { describe, it, expect, vi } from "vitest";
import { WooRestClient } from "./woo-rest-client";

function makeClient(fetchFn: any) {
  return new WooRestClient(
    { siteUrl: "https://shop.test", consumerKey: "ck", consumerSecret: "cs" },
    fetchFn,
  );
}

describe("WooRestClient", () => {
  it("sends an Idempotency-Key header when an idempotency key is supplied", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    const client = makeClient(fetchFn);
    await client.request("POST", "/orders", { body: { x: 1 }, idempotencyKey: "tenant-1:sale-1" });
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ "Idempotency-Key": "tenant-1:sale-1" });
  });

  it("omits the Idempotency-Key header when no key is supplied", async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response("[]", { status: 200 }));
    const client = makeClient(fetchFn);
    await client.request("GET", "/products");
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    expect(init.headers).not.toHaveProperty("Idempotency-Key");
  });
});
