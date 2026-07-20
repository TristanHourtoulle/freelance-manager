-- Drop the unused invoice_files table.
-- The model had zero references outside the generated Prisma client and no
-- upload path ever existed; invoice PDFs are owned by Abby.fr.
-- Verified empty before this migration was written.

DROP TABLE IF EXISTS "invoice_files";
