const NBSP = " "

const eurNoDigits = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

const eur2Digits = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function hasCents(n: number): boolean {
  return Math.round(n * 100) % 100 !== 0
}

const dateLong = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
})

const dateShort = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
})

/**
 * Format a number as EUR. Shows decimals only when the amount has cents
 * ("1 500 €" for round numbers, "937,50 €" otherwise). Returns "—" for
 * null/undefined/NaN.
 */
export function fmtEUR(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  return hasCents(n) ? eur2Digits.format(n) : eurNoDigits.format(n)
}

/**
 * Format a number as EUR with 2 fractional digits ("1 500,00 €").
 * Returns "—" for null/undefined/NaN.
 */
export function fmtEURprecise(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—"
  return eur2Digits.format(n)
}

/**
 * Format an ISO date string ("2026-04-30") or Date as "30 avr. 2026".
 * Returns "—" for falsy input.
 */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—"
  return dateLong.format(new Date(iso))
}

/**
 * Format an ISO date string or Date as "30 avr." (no year).
 * Returns "—" for falsy input.
 */
export function fmtDateShort(iso: string | Date | null | undefined): string {
  if (!iso) return "—"
  return dateShort.format(new Date(iso))
}

/**
 * Render a date relative to today: "aujourd'hui", "hier", "demain",
 * "il y a 3j", "il y a 2 sem", "il y a 4 mois", "dans 5j", or fall back to
 * fmtDateShort for anything past one week in the future.
 */
export function fmtRelative(iso: string | Date | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "aujourd'hui"
  if (diff === -1) return "hier"
  if (diff === 1) return "demain"
  if (diff < 0 && diff >= -7) return `il y a ${-diff}j`
  if (diff < 0 && diff >= -30) return `il y a ${Math.round(-diff / 7)} sem`
  if (diff < 0) return `il y a ${Math.round(-diff / 30)} mois`
  if (diff <= 7) return `dans ${diff}j`
  return fmtDateShort(iso)
}

/**
 * Take a person/company name and return up to two uppercase initials.
 * Used for circular avatar fallbacks. "Henri Mistral" → "HM".
 */
export function initials(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => (s[0] ?? "").toUpperCase())
    .join("")
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, oklch(0.6 0.15 250), oklch(0.55 0.18 320))",
  "linear-gradient(135deg, oklch(0.6 0.15 30), oklch(0.55 0.18 60))",
  "linear-gradient(135deg, oklch(0.55 0.16 150), oklch(0.6 0.18 180))",
  "linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.6 0.16 220))",
  "linear-gradient(135deg, oklch(0.6 0.17 0), oklch(0.55 0.18 350))",
  "linear-gradient(135deg, oklch(0.6 0.14 80), oklch(0.55 0.16 110))",
  "linear-gradient(135deg, oklch(0.55 0.15 200), oklch(0.6 0.18 240))",
] as const

/**
 * Pick a stable avatar gradient for a given seed string. Same input always
 * yields the same gradient — used so newly-created clients get a deterministic
 * color until they pick one.
 */
export function avatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) | 0
  }
  const idx = Math.abs(h) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[idx] as string
}

void NBSP
