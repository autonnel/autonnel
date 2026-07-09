import { describe, it, expect, vi } from "vitest";
import { InProcessJobHandlerRegistry } from "./job-handler-registry";
import { InProcessHookRegistry } from "./hook-registry";
import { InProcessMcpServer } from "./mcp-server";

describe("InProcessJobHandlerRegistry", () => {
  it("registers and resolves handlers by kind; has() reflects registration", () => {
    const r = new InProcessJobHandlerRegistry();
    const handler = vi.fn(async () => "ok");
    r.register("outbox.drain", handler);
    expect(r.has("outbox.drain")).toBe(true);
    expect(r.has("nope")).toBe(false);
    expect(r.resolve("outbox.drain")).toBe(handler);
  });

  it("rejects duplicate kind registration", () => {
    const r = new InProcessJobHandlerRegistry();
    r.register("k", async () => {});
    expect(() => r.register("k", async () => {})).toThrow(/already/i);
  });
});

describe("InProcessHookRegistry (shell)", () => {
  it("runs an action fan-out over registered listeners (no return value)", async () => {
    const r = new InProcessHookRegistry();
    const seen: number[] = [];
    r.addAction("order.paid", async (n: unknown) => { seen.push(n as number); });
    r.addAction("order.paid", async (n: unknown) => { seen.push((n as number) + 1); });
    await r.doAction("order.paid", 10);
    expect(seen.sort()).toEqual([10, 11]);
  });

  it("applies a filter pipeline threading the value through", async () => {
    const r = new InProcessHookRegistry();
    r.addFilter("price", async (v: unknown) => (v as number) * 2);
    r.addFilter("price", async (v: unknown) => (v as number) + 1);
    expect(await r.applyFilters("price", 5)).toBe(11);
  });
});

describe("InProcessMcpServer (shell)", () => {
  it("lists registered tool descriptors", () => {
    const s = new InProcessMcpServer();
    s.registerTool({ name: "list_orders", description: "x", requiredFeature: "ORDERS" }, async () => ({}));
    expect(s.listTools().map((t) => t.name)).toContain("list_orders");
  });
});
