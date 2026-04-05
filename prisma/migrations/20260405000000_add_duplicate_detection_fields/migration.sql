-- D4-04v2: Add duplicate detection fields (contentHash, semanticKey) to Document
-- These fields were added to schema.prisma but migration was missing (QA Blocker 2)

-- AlterTable: add contentHash (nullable String, index on [contentHash, projectId])
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "semanticKey" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_contentHash_projectId_idx" ON "Document"("contentHash", "projectId");
CREATE INDEX IF NOT EXISTS "Document_semanticKey_projectId_idx" ON "Document"("semanticKey", "projectId");
