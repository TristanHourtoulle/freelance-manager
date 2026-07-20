-- Quick capture: an action may exist before it is attached to a client.
--
-- The mandatory FK forced a taxonomy decision at capture time, which is the
-- single reason nothing gets captured on the move. Dropping NOT NULL is an
-- additive, non-destructive change: every existing row already holds a real
-- client id and is untouched. The FK and its ON DELETE CASCADE stay in place --
-- Postgres simply never fires it for NULL rows.
--
-- Rows with a NULL client surface as the "Non classe" bucket in the Suivi view
-- and are triaged from there.

ALTER TABLE "client_actions"
  ALTER COLUMN "clientId" DROP NOT NULL;
