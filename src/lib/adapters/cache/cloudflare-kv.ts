import { getBinding } from "@/lib/runtime/env";
import { createLogger } from "@/lib/logger";
import type { CacheAdapter } from "./types";

const KV_BINDING = "CACHE_KV";
const KV_MIN_TTL = 60;

const log = createLogger("CloudflareKV");

function asPutOptions(ttlSeconds?: number): KVNamespacePutOptions {
  if (!ttlSeconds) return {};
  return { expirationTtl: Math.max(ttlSeconds, KV_MIN_TTL) };
}

function prefixFromGlob(pattern: string): string {
  return pattern.replace(/\*.*$/, "");
}

export class CloudflareKVCacheAdapter implements CacheAdapter {
  private readonly ns: string;

  constructor(keyPrefix: string = "autonnel:") {
    this.ns = keyPrefix;
  }

  private kv(): KVNamespace {
    const binding = getBinding<KVNamespace>(KV_BINDING);
    if (!binding) throw new Error("CACHE_KV binding not available");
    return binding;
  }

  private fullKey(key: string): string {
    return this.ns + key;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const text = await this.kv().get(this.fullKey(key), "text");
      return text ? (JSON.parse(text) as T) : null;
    } catch (error) {
      log.error("Get error", { error, key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      await this.kv().put(this.fullKey(key), JSON.stringify(value), asPutOptions(ttlSeconds));
    } catch (error) {
      log.error("Set error", { error, key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv().delete(this.fullKey(key));
    } catch (error) {
      log.error("Delete error", { error, key });
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const listPrefix = this.fullKey(prefixFromGlob(pattern));
      let cursor: string | undefined;
      do {
        const page = await this.kv().list({ prefix: listPrefix, cursor });
        if (page.keys.length > 0) {
          await Promise.all(page.keys.map((entry) => this.kv().delete(entry.name)));
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
    } catch (error) {
      log.error("DeletePattern error", { error, pattern });
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.kv().get(this.fullKey(key), "text");
      return value !== null;
    } catch (error) {
      log.error("Has error", { error, key });
      return false;
    }
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const occupied = await this.get<string>(key);
      if (occupied !== null) return false;
      await this.set(key, "1", ttlSeconds);
      return true;
    } catch (error) {
      log.error("AcquireLock error", { error, key });
      return false;
    }
  }

  async releaseLock(key: string): Promise<void> {
    await this.delete(key);
  }
}
