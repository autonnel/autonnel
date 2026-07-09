const HOST_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63})+$/;

export function normalizeHost(raw: string): string {
  const host = raw.trim().toLowerCase();
  if (!HOST_RE.test(host)) throw new Error(`Invalid domain format: ${raw}`);
  return host;
}

export class Domain {
  private constructor(
    public id: string,
    readonly tenantId: string,
    readonly host: string,
    public isPrimary: boolean,
  ) {}

  static create(input: { tenantId: string; host: string; isPrimary?: boolean }): Domain {
    return new Domain('', input.tenantId, normalizeHost(input.host), input.isPrimary === true);
  }

  static rehydrate(input: { id: string; tenantId: string; host: string; isPrimary: boolean }): Domain {
    return new Domain(input.id, input.tenantId, input.host, input.isPrimary);
  }
}

export class DomainSet {
  constructor(private readonly domains: Domain[]) {}

  hasPrimary(): boolean {
    return this.domains.some((d) => d.isPrimary);
  }

  primary(): Domain | null {
    return this.domains.find((d) => d.isPrimary) ?? null;
  }

  /** When adding the first domain it becomes primary automatically. */
  resolveNewPrimary(requested: boolean): boolean {
    if (this.domains.length === 0) return true;
    return requested;
  }
}
