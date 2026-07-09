import { SecretRef } from "./config-entry";

export interface ConfigCandidates {
  tenant?: unknown;
  global?: unknown;
  env?: unknown;
  manifestDefault?: unknown;
}

export class ConfigResolutionService {
  // Invariant precedence: tenant -> global -> env -> manifest default.
  resolve(c: ConfigCandidates, opts: { secretReader?: boolean } = {}): unknown {
    const value = c.tenant ?? c.global ?? c.env ?? c.manifestDefault;
    if (value instanceof SecretRef && !opts.secretReader) return "[REDACTED]";
    return value;
  }
}
