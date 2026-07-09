// Lifecycle: INSTALLED -> ENABLED <-> DISABLED -> UNINSTALLED. Must be ENABLED to participate
// at runtime; uninstall only after disable (config removed but audited at the repo layer).
export type InstallationStatus = "INSTALLED" | "ENABLED" | "DISABLED" | "UNINSTALLED";

export interface InstallationSnapshot {
  tenantId: string;
  pluginId: string;
  status: InstallationStatus;
  version: string;
  resolvedConfig: unknown;
  capabilities: string[];
}

export class PluginInstallation {
  private constructor(private s: InstallationSnapshot) {}

  static install(args: Omit<InstallationSnapshot, "status">): PluginInstallation {
    return new PluginInstallation({ ...args, status: "INSTALLED" });
  }

  static rehydrate(s: InstallationSnapshot): PluginInstallation {
    return new PluginInstallation({ ...s });
  }

  snapshot(): InstallationSnapshot {
    return { ...this.s, capabilities: [...this.s.capabilities] };
  }

  enable(): void {
    if (this.s.status === "UNINSTALLED") throw new Error("cannot enable an uninstalled plugin");
    this.s.status = "ENABLED";
  }

  disable(): void {
    if (this.s.status !== "ENABLED") throw new Error("can only disable an ENABLED plugin");
    this.s.status = "DISABLED";
  }

  uninstall(): void {
    if (this.s.status === "ENABLED") throw new Error("disable before uninstall");
    this.s.status = "UNINSTALLED";
  }

  participatesAtRuntime(): boolean {
    return this.s.status === "ENABLED";
  }
}
