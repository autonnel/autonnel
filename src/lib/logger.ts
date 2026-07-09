// Server code uses this; never console.* directly. Browser code is exempt.
import { readEnv } from "./runtime/env";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function activeLevel(): Level {
  const raw = (readEnv("LOG_LEVEL") ?? "info").toLowerCase();
  return (["debug", "info", "warn", "error"] as Level[]).includes(raw as Level) ? (raw as Level) : "info";
}

function normalizeMeta(meta?: Record<string, unknown>): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === "error" && v instanceof Error) {
      out.error = { message: v.message, name: v.name, stack: v.stack };
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(segment: string): Logger;
}

export function createLogger(moduleName: string): Logger {
  const emit = (level: Level, message: string, meta?: Record<string, unknown>) => {
    if (ORDER[level] < ORDER[activeLevel()]) return;
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        module: moduleName,
        message,
        ...normalizeMeta(meta),
      }),
    );
  };
  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    child: (segment) => createLogger(`${moduleName}:${segment}`),
  };
}
