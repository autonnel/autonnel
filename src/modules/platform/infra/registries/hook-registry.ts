// Only ENABLED plugins' hooks should be registered (resolved upstream).
type ActionFn = (...args: unknown[]) => Promise<void>;
type FilterFn = (value: unknown, ...args: unknown[]) => Promise<unknown>;

export class InProcessHookRegistry {
  private readonly actions = new Map<string, ActionFn[]>();
  private readonly filters = new Map<string, FilterFn[]>();

  addAction(point: string, fn: ActionFn): void {
    (this.actions.get(point) ?? this.actions.set(point, []).get(point)!).push(fn);
  }

  addFilter(point: string, fn: FilterFn): void {
    (this.filters.get(point) ?? this.filters.set(point, []).get(point)!).push(fn);
  }

  async doAction(point: string, ...args: unknown[]): Promise<void> {
    await Promise.all((this.actions.get(point) ?? []).map((fn) => fn(...args)));
  }

  async applyFilters<T>(point: string, value: T, ...args: unknown[]): Promise<T> {
    let acc: unknown = value;
    for (const fn of this.filters.get(point) ?? []) acc = await fn(acc, ...args);
    return acc as T;
  }
}
