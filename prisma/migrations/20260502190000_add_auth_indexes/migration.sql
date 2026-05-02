-- Add missing FK + cleanup indexes on better-auth tables.
-- Speeds up sign-in lookups, session resolution, and expired-row pruning.

-- Sessions: user-scoped lookups + expiresAt cleanup
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX IF NOT EXISTS "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- Accounts: user-scoped lookups + (provider, accountId) at sign-in
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");
CREATE INDEX IF NOT EXISTS "accounts_providerId_accountId_idx" ON "accounts"("providerId", "accountId");

-- Verifications: token lookup by identifier + expiry pruning
CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verifications"("identifier");
CREATE INDEX IF NOT EXISTS "verifications_expiresAt_idx" ON "verifications"("expiresAt");
