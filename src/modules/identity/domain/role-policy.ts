import { type FeatureKey, isFeatureKey } from './feature-key';

interface RolePolicyState {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  grants: FeatureKey[];
}

// Grants reference only FEATURES-catalog keys; unknown keys are silently ignored for forward-compat.
export class RolePolicy {
  private constructor(private state: RolePolicyState) {}

  static create(input: { id: string; name: string; description?: string | null; isSystem: boolean; grants: FeatureKey[] }): RolePolicy {
    if (!input.name || input.name.trim().length === 0) throw new Error('Role name required');
    return new RolePolicy({ ...input, description: input.description ?? null, grants: [...input.grants] });
  }

  get id() { return this.state.id; }
  get name() { return this.state.name; }
  get description() { return this.state.description; }
  get isSystem() { return this.state.isSystem; }

  rename(name: string): void {
    if (this.state.isSystem) throw new Error('Cannot modify a system role');
    if (!name || name.trim().length === 0) throw new Error('Role name required');
    this.state.name = name.trim();
  }

  setDescription(description: string | null): void {
    if (this.state.isSystem) throw new Error('Cannot modify a system role');
    this.state.description = description;
  }

  grants(): readonly FeatureKey[] {
    return this.state.grants;
  }

  setGrants(requested: string[], knownFeatureKeys: ReadonlySet<string>): void {
    if (this.state.isSystem) throw new Error('Cannot modify a system role');
    this.applyGrants(requested, knownFeatureKeys);
  }

  // System roles keep locked name/description but their feature grants remain editable.
  setFeatureGrants(requested: string[], knownFeatureKeys: ReadonlySet<string>): void {
    this.applyGrants(requested, knownFeatureKeys);
  }

  private applyGrants(requested: string[], knownFeatureKeys: ReadonlySet<string>): void {
    const valid = requested
      .filter((k) => isFeatureKey(k) && knownFeatureKeys.has(k))
      .map((k) => k as FeatureKey);
    this.state.grants = [...new Set(valid)];
  }
}
