import { describe, it, expect, afterEach } from "vitest";
import { dbAll, isHyperdrivePool, HYPERDRIVE_POOL_SIZE } from "./db";
import { setRuntimeEnv } from "./runtime/env";

function makeTask(order: string[], name: string, delayMs: number) {
  return async () => {
    order.push(`${name}:start`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    order.push(`${name}:end`);
    return name;
  };
}

function makeTrackedTask<T>(
  inFlight: { current: number; peak: number },
  delayMs: number,
  value: T,
) {
  return async () => {
    inFlight.current++;
    inFlight.peak = Math.max(inFlight.peak, inFlight.current);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    inFlight.current--;
    return value;
  };
}

describe("dbAll", () => {
  afterEach(() => setRuntimeEnv(undefined));

  it("isHyperdrivePool reflects the HYPERDRIVE binding", () => {
    expect(isHyperdrivePool()).toBe(false);
    setRuntimeEnv({ HYPERDRIVE: { connectionString: "postgres://x" } });
    expect(isHyperdrivePool()).toBe(true);
  });

  it("on Hyperdrive, results come back in input order regardless of completion order", async () => {
    setRuntimeEnv({ HYPERDRIVE: { connectionString: "postgres://x" } });
    const order: string[] = [];
    // a takes longer than b, but the result tuple must still be positional.
    const [a, b] = await dbAll([makeTask(order, "a", 20), makeTask(order, "b", 0)]);

    expect(a).toBe("a");
    expect(b).toBe("b");
    expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a:end"));
  });

  it("on Hyperdrive, never runs more than HYPERDRIVE_POOL_SIZE thunks concurrently", async () => {
    setRuntimeEnv({ HYPERDRIVE: { connectionString: "postgres://x" } });
    const inFlight = { current: 0, peak: 0 };
    const tasks = Array.from({ length: HYPERDRIVE_POOL_SIZE * 3 }, (_, i) =>
      makeTrackedTask(inFlight, 5, i),
    );

    await dbAll(tasks);

    expect(inFlight.peak).toBeLessThanOrEqual(HYPERDRIVE_POOL_SIZE);
    expect(inFlight.peak).toBeGreaterThan(1);
  });

  it("on Hyperdrive, with more thunks than the cap every thunk still runs and all results return in order", async () => {
    setRuntimeEnv({ HYPERDRIVE: { connectionString: "postgres://x" } });
    const width = HYPERDRIVE_POOL_SIZE * 2 + 1;
    const tasks = Array.from({ length: width }, (_, i) => async () => i);

    const results = await dbAll(tasks);

    expect(results).toEqual(Array.from({ length: width }, (_, i) => i));
  });

  it("off Hyperdrive, runs thunks concurrently", async () => {
    const order: string[] = [];
    // a takes longer than b; concurrent execution means b finishes before a does.
    const [a, b] = await dbAll([makeTask(order, "a", 20), makeTask(order, "b", 0)]);

    expect(a).toBe("a");
    expect(b).toBe("b");
    expect(order[0]).toBe("a:start");
    expect(order[1]).toBe("b:start");
    expect(order.indexOf("b:end")).toBeLessThan(order.indexOf("a:end"));
  });

  it("off Hyperdrive, does not cap concurrency", async () => {
    const inFlight = { current: 0, peak: 0 };
    const tasks = Array.from({ length: HYPERDRIVE_POOL_SIZE * 3 }, (_, i) =>
      makeTrackedTask(inFlight, 5, i),
    );

    await dbAll(tasks);

    expect(inFlight.peak).toBe(tasks.length);
  });

  it("preserves per-slot result types and values", async () => {
    const [count, rows] = await dbAll([
      async () => 3,
      async () => ["x", "y"],
    ]);
    expect(count).toBe(3);
    expect(rows).toEqual(["x", "y"]);
  });
});
