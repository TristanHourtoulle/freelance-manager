// Lightweight typed fetch wrapper used by all TanStack Query hooks. Throws on
// non-OK responses so React Query treats them as errors.

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { error?: string; detail?: unknown }
      if (body.error) message = body.error
    } catch {
      // body wasn't JSON — keep the default message
    }
    throw new Error(message)
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
