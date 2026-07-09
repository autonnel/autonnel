import type { FeatureKey } from './feature-key';

export class PermissionSet {
  private readonly keys: ReadonlySet<FeatureKey>;

  private constructor(keys: Iterable<FeatureKey>) {
    this.keys = new Set(keys);
  }

  static of(keys: Iterable<FeatureKey>): PermissionSet {
    return new PermissionSet(keys);
  }

  static empty(): PermissionSet {
    return new PermissionSet([]);
  }

  has(key: FeatureKey): boolean {
    return this.keys.has(key);
  }

  hasAll(keys: readonly FeatureKey[]): boolean {
    return keys.every((k) => this.keys.has(k));
  }

  hasAny(keys: readonly FeatureKey[]): boolean {
    return keys.some((k) => this.keys.has(k));
  }

  merge(other: PermissionSet): PermissionSet {
    return new PermissionSet([...this.keys, ...other.keys]);
  }

  toArray(): FeatureKey[] {
    return [...this.keys];
  }
}
