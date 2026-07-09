import { describe, it, expect, vi } from "vitest";
import { GetEffectiveConfigService, SetConfigService } from "./config.service";
import { SecretRef } from "../domain/config-entry";

const makeRepo = (rows: Record<string, { value: unknown; isSecret: boolean }>) => ({
  get: vi.fn(async (tenantId: string, key: string) => rows[`${tenantId}:${key}`] ?? null),
  set: vi.fn(async () => {}),
});

describe("GetEffectiveConfigService", () => {
  it("prefers tenant row over env fallback", async () => {
    const repo = makeRepo({ "default:llm.model": { value: "gpt-x", isSecret: false } });
    const env = { read: () => "env-model" };
    const svc = new GetEffectiveConfigService(repo as any, env as any, { current: () => "default" } as any);
    expect(await svc.get("llm.model")).toBe("gpt-x");
  });

  it("falls back to env when no tenant/global row exists (OSS)", async () => {
    const repo = makeRepo({});
    const env = { read: () => "env-model" };
    const svc = new GetEffectiveConfigService(repo as any, env as any, { current: () => "default" } as any);
    expect(await svc.get("llm.model")).toBe("env-model");
  });

  it("redacts secrets for non-secret reads", async () => {
    const repo = makeRepo({ "default:stripe.key": { value: new SecretRef("kv://x"), isSecret: true } });
    const env = { read: () => undefined };
    const svc = new GetEffectiveConfigService(repo as any, env as any, { current: () => "default" } as any);
    expect(await svc.get("stripe.key")).toBe("[REDACTED]");
    expect(await svc.get("stripe.key", { secretReader: true })).toBeInstanceOf(SecretRef);
  });
});

describe("SetConfigService", () => {
  it("validates the key and persists the row", async () => {
    const repo = makeRepo({});
    const svc = new SetConfigService(repo as any, { current: () => "default" } as any);
    await svc.set("llm.model", "gpt-x");
    expect(repo.set).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "default", configKey: "llm.model", value: "gpt-x" }));
  });
});
