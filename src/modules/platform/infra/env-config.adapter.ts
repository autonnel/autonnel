import type { EnvConfigPort } from "../application/ports";
import { readEnv } from "../../../lib/runtime/env";

// Maps dotted config keys to env var names (UPPER_SNAKE). OSS relies on this fallback layer.
export class EnvConfigAdapter implements EnvConfigPort {
  read(configKey: string): unknown {
    return readEnv(configKey.replace(/\./g, "_").toUpperCase());
  }
}
