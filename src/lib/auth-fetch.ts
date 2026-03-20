"use client"

/**
 * Fetch wrapper that redirects to the landing page on 401 responses.
 * Use this for all authenticated API calls to handle session expiry.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init)

  if (response.status === 401 && typeof window !== "undefined") {
    window.location.href = "/"
  }

  return response
}
