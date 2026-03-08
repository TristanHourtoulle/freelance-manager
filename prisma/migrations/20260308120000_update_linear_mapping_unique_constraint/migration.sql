-- DropIndex
DROP INDEX "linear_mappings_clientId_linearTeamId_key";

-- CreateIndex
CREATE UNIQUE INDEX "linear_mappings_clientId_linearProjectId_key" ON "linear_mappings"("clientId", "linearProjectId");
