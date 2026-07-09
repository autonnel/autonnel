export class SyncCursor {
  private constructor(readonly value: string | null) {}
  static start(): SyncCursor {
    return new SyncCursor(null);
  }
  static of(value: string): SyncCursor {
    return new SyncCursor(value);
  }
  isStart(): boolean {
    return this.value === null;
  }
}
