export interface ProviderHttpError extends Error {
  httpStatus?: number;
  network?: boolean;
}

export function httpError(message: string, httpStatus?: number): ProviderHttpError {
  const e = new Error(message) as ProviderHttpError;
  e.httpStatus = httpStatus;
  return e;
}
