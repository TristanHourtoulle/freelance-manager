/**
 * Error thrown by every `api.*` helper on a non-2xx response.
 *
 * Carries the HTTP status so callers can branch on it (e.g. 409 conflicts)
 * instead of pattern-matching the server message. `message` stays identical to
 * what a plain `Error` used to carry, so existing `e.message` call sites are
 * unaffected.
 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

/**
 * Narrows an unknown rejection to an `ApiError` carrying the given status.
 *
 * @param error - The rejection value from an `api.*` call.
 * @param status - The HTTP status to match.
 * @returns `true` when the error is an `ApiError` with that status.
 */
export function isApiErrorWithStatus(
  error: unknown,
  status: number,
): error is ApiError {
  return error instanceof ApiError && error.status === status
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string; detail?: unknown }
      if (body.error) message = body.error
    } catch {}
    throw new ApiError(message, res.status)
  }
  return (await res.json()) as T
}

export const api = {
  get: <T>(url: string) =>
    fetch(url, { credentials: "include" }).then((r) => handle<T>(r)),
  post: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: "POST",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handle<T>(r)),
  patch: <T>(url: string, body: unknown) =>
    fetch(url, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  put: <T>(url: string, body: unknown) =>
    fetch(url, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => handle<T>(r)),
  delete: <T>(url: string) =>
    fetch(url, { method: "DELETE", credentials: "include" }).then((r) =>
      handle<T>(r),
    ),
}
