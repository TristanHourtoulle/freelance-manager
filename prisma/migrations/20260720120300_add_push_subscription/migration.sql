-- Web Push subscriptions.
--
-- One row per browser/device that opted into the daily digest. `endpoint` is
-- UNIQUE so a browser re-subscribing upserts instead of accumulating stale
-- duplicates: the database is the guard, not an application read-then-write.
--
-- ON DELETE CASCADE removes a user's subscriptions with the user. The failure
-- columns exist because push services silently drop endpoints (notably iOS
-- when a PWA is uninstalled); a 404/410 prunes the row, anything else is
-- counted so a dead subscription can be surfaced later.

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "lastDeliveredAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key"
  ON "push_subscriptions"("endpoint");

CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_idx"
  ON "push_subscriptions"("userId");

ALTER TABLE "push_subscriptions"
  ADD CONSTRAINT "push_subscriptions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
