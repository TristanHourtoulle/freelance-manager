-- Devis (quotes) tracked locally, TRACK-ONLY: this app never emits the
-- document. `externalUrl` points at the Abby.fr devis, which stays the single
-- legally binding source of truth. Numbering lives in its own sequence
-- (`D-YYYY-NNNN`) so it can never collide with the invoice namespace.

DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REFUSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "quotes" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "clientId"    TEXT NOT NULL,
  "projectId"   TEXT,
  "number"      TEXT NOT NULL,
  "status"      "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "issueDate"   TIMESTAMP(3) NOT NULL,
  "validUntil"  TIMESTAMP(3),
  "sentAt"      TIMESTAMP(3),
  "decidedAt"   TIMESTAMP(3),
  "subtotal"    DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes"       TEXT,
  "externalUrl" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quote_lines" (
  "id"        TEXT NOT NULL,
  "quoteId"   TEXT NOT NULL,
  "taskId"    TEXT,
  "label"     TEXT NOT NULL,
  "qty"       DECIMAL(10,2) NOT NULL,
  "rate"      DECIMAL(10,2) NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quotes_userId_number_key" ON "quotes"("userId", "number");
CREATE INDEX IF NOT EXISTS "quotes_userId_idx" ON "quotes"("userId");
CREATE INDEX IF NOT EXISTS "quotes_userId_status_idx" ON "quotes"("userId", "status");
CREATE INDEX IF NOT EXISTS "quotes_userId_issueDate_idx" ON "quotes"("userId", "issueDate" DESC);
CREATE INDEX IF NOT EXISTS "quotes_clientId_idx" ON "quotes"("clientId");
CREATE INDEX IF NOT EXISTS "quote_lines_quoteId_idx" ON "quote_lines"("quoteId");

DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotes" ADD CONSTRAINT "quotes_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
