// Production wires kinds via import.meta.glob, never node:fs (CF Workers constraint).
import type { JobHandler, JobHandlerRegistryPort } from "../../application/ports";

export class InProcessJobHandlerRegistry implements JobHandlerRegistryPort {
  private readonly map = new Map<string, JobHandler>();

  register(kind: string, handler: JobHandler): void {
    if (this.map.has(kind)) throw new Error(`job kind "${kind}" already registered`);
    this.map.set(kind, handler);
  }

  has(kind: string): boolean {
    return this.map.has(kind);
  }

  resolve(kind: string): JobHandler | undefined {
    return this.map.get(kind);
  }
}
