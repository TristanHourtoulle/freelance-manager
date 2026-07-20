import webpush from "web-push"

let configured = false

/**
 * Whether Web Push is configured on this deployment.
 *
 * @returns `true` when every VAPID variable is present.
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_SUBJECT &&
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY,
  )
}

/**
 * Apply the VAPID credentials to the web-push client, at most once.
 *
 * Called lazily so importing this module never throws on a deployment that
 * has no keys — push simply stays off and the rest of the app boots.
 *
 * @returns `true` when the client is ready to send, `false` when unconfigured.
 */
export function configureWebPush(): boolean {
  if (!isPushConfigured()) return false
  if (configured) return true

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT as string,
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  )
  configured = true
  return true
}
