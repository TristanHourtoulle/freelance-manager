-- Add a key-version byte to support rotating the AES-256-GCM key used for
-- Linear API tokens. Existing rows that hold a token are backfilled to v1.

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "linearApiTokenKeyVersion" INTEGER DEFAULT 1;

UPDATE "user_settings"
  SET "linearApiTokenKeyVersion" = 1
  WHERE "linearApiTokenEncrypted" IS NOT NULL
    AND "linearApiTokenKeyVersion" IS NULL;
