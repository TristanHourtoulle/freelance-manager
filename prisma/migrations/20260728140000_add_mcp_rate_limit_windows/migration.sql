-- Postgres-backed rate limiter for the MCP endpoint, replacing the
-- in-process fixed-window limiter (unsound the moment there is more than
-- one instance, since each instance would enforce the limit independently).
--
-- One row per principal (today, always the single MCP owner's userId).
-- McpRateLimiter.check performs the whole "is this still inside the
-- window, and does this request tip it over" decision as a single
-- INSERT ... ON CONFLICT DO UPDATE statement, so two concurrent requests
-- racing on the same row serialize on Postgres's normal row lock instead of
-- both reading a pre-increment count and both deciding they are allowed.

CREATE TABLE IF NOT EXISTS "mcp_rate_limit_windows" (
  "userId" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_rate_limit_windows_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "mcp_rate_limit_windows"
  ADD CONSTRAINT "mcp_rate_limit_windows_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
