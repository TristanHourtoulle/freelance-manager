-- Suivi feature: non-dev client ops (actions + meetings), distinct from the
-- Linear-mirrored tasks. Adds two ActivityKind values, two enums and two tables.

-- New ActivityKind values (safe in a transaction on PG12+: not used here).
ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'ACTION_DONE';
ALTER TYPE "ActivityKind" ADD VALUE IF NOT EXISTS 'MEETING_LOGGED';

-- Enums
CREATE TYPE "ClientActionType" AS ENUM ('RELANCE', 'LINK', 'RDV', 'OTHER');
CREATE TYPE "ClientActionStatus" AS ENUM ('TODO', 'DONE');

-- Meetings
CREATE TABLE "meetings" (
  "id"              TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "clientId"        TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "teamsUrl"        TEXT,
  "heldAt"          TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 0,
  "participants"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summaryMd"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "meetings_userId_idx"           ON "meetings"("userId");
CREATE INDEX "meetings_userId_heldAt_idx"    ON "meetings"("userId", "heldAt" DESC);
CREATE INDEX "meetings_clientId_heldAt_idx"  ON "meetings"("clientId", "heldAt" DESC);

-- Client actions
CREATE TABLE "client_actions" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "clientId"  TEXT NOT NULL,
  "type"      "ClientActionType" NOT NULL DEFAULT 'OTHER',
  "title"     TEXT NOT NULL,
  "link"      TEXT,
  "notes"     TEXT,
  "status"    "ClientActionStatus" NOT NULL DEFAULT 'TODO',
  "dueDate"   TIMESTAMP(3),
  "doneAt"    TIMESTAMP(3),
  "invoiceId" TEXT,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_actions_userId_idx"               ON "client_actions"("userId");
CREATE INDEX "client_actions_userId_status_idx"        ON "client_actions"("userId", "status");
CREATE INDEX "client_actions_userId_status_dueDate_idx" ON "client_actions"("userId", "status", "dueDate");
CREATE INDEX "client_actions_clientId_idx"             ON "client_actions"("clientId");
CREATE INDEX "client_actions_invoiceId_idx"            ON "client_actions"("invoiceId");
CREATE INDEX "client_actions_meetingId_idx"            ON "client_actions"("meetingId");

-- Foreign keys
ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_userId_fkey"   FOREIGN KEY ("userId")   REFERENCES "users"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "meetings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_actions"
  ADD CONSTRAINT "client_actions_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "users"("id")     ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "client_actions_clientId_fkey"  FOREIGN KEY ("clientId")  REFERENCES "clients"("id")   ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "client_actions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "client_actions_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
