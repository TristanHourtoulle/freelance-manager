-- Data repair: fold a genuine late-payment penalty back into an invoice's
-- own numbers instead of leaving it flagged "OVERPAID".
--
-- Bug: before the late-payment-penalty feature existed, a client paying the
-- 40 EUR flat fee (plus interest) on top of the invoice principal had no
-- column to receive it, so the payment simply pushed the invoice's collected
-- total past its "total" and it landed on "paymentStatus" = 'OVERPAID'. The
-- application code no longer does this (penalties are now recorded via
-- "invoices"."lateFeeFixed" / "lateFeeInterest" / "lateFeeClaimedAt" and
-- "payments"."penaltyAmount"), but existing OVERPAID rows stay wrong until
-- repaired here. Known cases in production: invoice "2026-1063" (44.94 EUR
-- overpay = 40 flat + 4.94 interest) and "F-2026-0009" (40.00 EUR overpay =
-- 40 flat + 0 interest).
--
-- Selection rule (by query, never by hard-coded id): an invoice is a
-- candidate when "paymentStatus" = 'OVERPAID', "lateFeeClaimedAt" IS NULL,
-- and its overpay (SUM("payments"."amount") - "total") is strictly positive
-- and at most "40 + 0.05 * total". The cap is deliberate: it separates a
-- plausible late-fee overpay from a genuine duplicate payment (which can
-- overpay by an arbitrary, much larger amount) — a duplicate must stay
-- OVERPAID for a human to reconcile, not get silently reclassified as paid.
--
-- For every candidate invoice:
--   1. "lateFeeFixed"     = LEAST(40, overpay)
--   2. "lateFeeInterest"  = overpay - "lateFeeFixed"
--   3. "lateFeeClaimedAt" = the invoice's most recent "payments"."paidAt"
--      (ties broken by "paidAt" DESC, "id" DESC, so repeated runs pick the
--      same row deterministically)
--   4. "paymentStatus"    = 'PAID'
--   5. that same most-recent payment row gets "penaltyAmount" = overpay
--
-- After this, "total" + 40 + interest - SUM(payments.amount) = 0 exactly and
-- the invoice's status is honest again.
--
-- Idempotent: the root CTE only selects invoices with "paymentStatus" =
-- 'OVERPAID' AND "lateFeeClaimedAt" IS NULL. The first run flips both of
-- those (to 'PAID' and a timestamp), which removes the row from every
-- downstream CTE — including the one driving the "payments" update — so a
-- second run touches 0 rows in either table. The invoices UPDATE also
-- restates the same guard in its own WHERE clause as a second safety net.

WITH overpaid_invoices AS (
  SELECT
    i.id AS invoice_id,
    i.total AS total,
    COALESCE(SUM(p.amount), 0) - i.total AS overpay
  FROM "invoices" i
  LEFT JOIN "payments" p ON p."invoiceId" = i.id
  WHERE i."paymentStatus" = 'OVERPAID'
    AND i."lateFeeClaimedAt" IS NULL
  GROUP BY i.id, i.total
),
eligible AS (
  SELECT
    invoice_id,
    overpay,
    LEAST(40, overpay) AS late_fee_fixed,
    overpay - LEAST(40, overpay) AS late_fee_interest
  FROM overpaid_invoices
  WHERE overpay > 0
    AND overpay <= 40 + 0.05 * total
),
latest_payment AS (
  SELECT DISTINCT ON (p."invoiceId")
    p.id AS payment_id,
    p."invoiceId" AS invoice_id,
    p."paidAt" AS paid_at
  FROM "payments" p
  JOIN eligible e ON e.invoice_id = p."invoiceId"
  ORDER BY p."invoiceId", p."paidAt" DESC, p.id DESC
),
updated_invoices AS (
  UPDATE "invoices" i
  SET
    "lateFeeFixed" = e.late_fee_fixed,
    "lateFeeInterest" = e.late_fee_interest,
    "lateFeeClaimedAt" = lp.paid_at,
    "paymentStatus" = 'PAID'::"PaymentStatus",
    "updatedAt" = NOW()
  FROM eligible e
  JOIN latest_payment lp ON lp.invoice_id = e.invoice_id
  WHERE i.id = e.invoice_id
    AND i."paymentStatus" = 'OVERPAID'
    AND i."lateFeeClaimedAt" IS NULL
  RETURNING i.id AS invoice_id, e.overpay AS overpay, lp.payment_id AS payment_id
)
UPDATE "payments" p
SET
  "penaltyAmount" = ui.overpay,
  "updatedAt" = NOW()
FROM updated_invoices ui
WHERE p.id = ui.payment_id;
