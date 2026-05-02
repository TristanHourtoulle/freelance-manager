import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV !== "production"

/**
 * Content-Security-Policy applied to every response. `'unsafe-inline'`
 * and `'unsafe-eval'` are required by Next dev mode and the inline
 * style attributes used by the design system; tightening to nonces is
 * tracked separately. `frame-ancestors 'none'` and `object-src 'none'`
 * prevent clickjacking and plugin abuse. `connect-src` whitelists the
 * Linear API for outbound XHRs from the dashboard.
 */
const csp = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.linear.app",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ")

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Content-Security-Policy", value: csp },
]

const nextConfig: NextConfig = {
  cacheComponents: true,
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@prisma/client",
    "@linear/sdk",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ]
  },
}

export default nextConfig
