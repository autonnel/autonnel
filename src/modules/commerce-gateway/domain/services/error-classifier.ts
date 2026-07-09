import { BackendError, BackendErrorClass } from "../value-objects/backend-error";

export interface ShopifyUserError {
  field?: string[];
  message: string;
}

export class ErrorClassifier {
  fromHttp(status: number, vendorRaw: unknown): BackendError {
    if (status === 429) return BackendError.of(BackendErrorClass.Throttled, true, vendorRaw);
    if (status === 401 || status === 403) return BackendError.of(BackendErrorClass.Auth, false, vendorRaw);
    if (status === 404) return BackendError.of(BackendErrorClass.NotFound, false, vendorRaw);
    if (status >= 500) return BackendError.of(BackendErrorClass.Network, true, vendorRaw);
    if (status >= 400) return BackendError.of(BackendErrorClass.Validation, false, vendorRaw);
    return BackendError.of(BackendErrorClass.Unknown, false, vendorRaw);
  }

  fromUserErrors(userErrors: ShopifyUserError[]): BackendError {
    return BackendError.of(BackendErrorClass.Validation, false, userErrors);
  }

  fromNetwork(cause: unknown): BackendError {
    return BackendError.of(BackendErrorClass.Network, true, cause);
  }
}
