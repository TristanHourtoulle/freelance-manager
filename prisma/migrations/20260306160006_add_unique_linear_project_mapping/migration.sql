-- DropIndex
DROP INDEX "linear_mappings_clientId_linearProjectId_key";

-- CreateIndex
CREATE UNIQUE INDEX "linear_mappings_linearProjectId_key" ON "linear_mappings"("linearProjectId");
