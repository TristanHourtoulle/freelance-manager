-- Two new ActivityLog kinds for the late-payment-penalty claim/waive
-- endpoint: LATE_FEE_CLAIMED when an operator freezes the accrued penalty
-- on an invoice, LATE_FEE_WAIVED when they clear it back to zero.

ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'LATE_FEE_CLAIMED';
ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'LATE_FEE_WAIVED';
