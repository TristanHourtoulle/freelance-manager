/**
 * Formats a numeric amount as a EUR currency string using French locale.
 *
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g. "1 500,00 €")
 *
 * @example
 * ```ts
 * formatCurrency(1500) // => "1 500,00 €"
 * ```
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}
