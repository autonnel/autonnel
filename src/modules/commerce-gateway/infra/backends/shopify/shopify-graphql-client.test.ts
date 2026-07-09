import { describe, it, expect, vi } from "vitest";
import { ShopifyGraphqlClient } from "./shopify-graphql-client";

describe("ShopifyGraphqlClient", () => {
  it("POSTs to the admin graphql endpoint with the access token header", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    const client = new ShopifyGraphqlClient(
      { shopDomain: "my-shop.myshopify.com", accessToken: "tok", apiVersion: "2024-01" },
      fetchFn,
    );
    const result = await client.query<{ ok: boolean }>("{ ok }", {});
    expect(result.ok).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://my-shop.myshopify.com/admin/api/2024-01/graphql.json");
    expect((init as unknown as RequestInit).headers).toMatchObject({
      "X-Shopify-Access-Token": "tok",
      "Content-Type": "application/json",
    });
  });

  it("sends an Idempotency-Key header when an idempotency key is supplied", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    const client = new ShopifyGraphqlClient(
      { shopDomain: "s.myshopify.com", accessToken: "tok", apiVersion: "2024-01" },
      fetchFn,
    );
    await client.query("{ ok }", {}, "tenant-1:sale-1");
    const [, init] = fetchFn.mock.calls[0]!;
    expect((init as unknown as RequestInit).headers).toMatchObject({ "Idempotency-Key": "tenant-1:sale-1" });
  });

  it("omits the Idempotency-Key header when no key is supplied", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }),
    );
    const client = new ShopifyGraphqlClient(
      { shopDomain: "s.myshopify.com", accessToken: "tok", apiVersion: "2024-01" },
      fetchFn,
    );
    await client.query("{ ok }", {});
    const [, init] = fetchFn.mock.calls[0]!;
    expect((init as unknown as RequestInit).headers).not.toHaveProperty("Idempotency-Key");
  });

  it("throws a BackendError on a non-2xx status", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response("{}", { status: 429 }));
    const client = new ShopifyGraphqlClient(
      { shopDomain: "s.myshopify.com", accessToken: "t", apiVersion: "2024-01" },
      fetchFn,
    );
    await expect(client.query("{ x }", {})).rejects.toMatchObject({ name: "BackendError", retryable: true });
  });

  it("throws a validation BackendError when the response carries graphql userErrors-style errors", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify({ errors: [{ message: "bad" }] }), { status: 200 }),
    );
    const client = new ShopifyGraphqlClient(
      { shopDomain: "s.myshopify.com", accessToken: "t", apiVersion: "2024-01" },
      fetchFn,
    );
    await expect(client.query("{ x }", {})).rejects.toMatchObject({ name: "BackendError" });
  });

  // Regression: the default fetchFn must invoke global fetch unbound. Node's fetch tolerates any
  // `this`, so we stub a Workers-strict fetch that rejects a non-global `this` (as the CF runtime
  // does with "Illegal invocation"). The buggy `= fetch` default would call it with this=client.
  it("invokes global fetch with a Workers-safe this binding when no fetchFn is injected", async () => {
    const realFetch = globalThis.fetch;
    const strictFetch = function (this: unknown, _url: string, _init?: RequestInit) {
      if (this !== undefined && this !== globalThis) {
        throw new TypeError("Illegal invocation: function called with incorrect `this` reference.");
      }
      return Promise.resolve(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    };
    globalThis.fetch = strictFetch as unknown as typeof fetch;
    try {
      const client = new ShopifyGraphqlClient({
        shopDomain: "s.myshopify.com",
        accessToken: "t",
        apiVersion: "2025-01",
      });
      await expect(client.query<{ ok: boolean }>("{ ok }", {})).resolves.toEqual({ ok: true });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
