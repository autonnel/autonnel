export enum BackendErrorClass {
  Throttled = "throttled",
  Auth = "auth",
  NotFound = "not_found",
  Validation = "validation",
  Network = "network",
  Unknown = "unknown",
}

export class BackendError extends Error {
  private constructor(
    readonly class_: BackendErrorClass,
    readonly retryable: boolean,
    readonly vendorRaw: unknown,
  ) {
    super(`BackendError(${class_})`);
    this.name = "BackendError";
  }
  static of(cls: BackendErrorClass, retryable: boolean, vendorRaw: unknown): BackendError {
    return new BackendError(cls, retryable, vendorRaw);
  }
  get class(): BackendErrorClass {
    return this.class_;
  }
}
