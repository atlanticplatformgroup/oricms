-- AlterTable
ALTER TABLE "agent_change_requests" ADD COLUMN     "baseCommitSha" TEXT;

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "workspaceDir" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferences" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "drafts" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pagePath" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "schemaIds" TEXT[],
    "previewToken" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "fieldKey" TEXT,
    "selection" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "siteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drafts_previewToken_key" ON "drafts"("previewToken");

-- CreateIndex
CREATE INDEX "drafts_siteId_previewToken_idx" ON "drafts"("siteId", "previewToken");

-- CreateIndex
CREATE INDEX "drafts_previewToken_idx" ON "drafts"("previewToken");

-- CreateIndex
CREATE UNIQUE INDEX "drafts_siteId_pageId_key" ON "drafts"("siteId", "pageId");

-- CreateIndex
CREATE INDEX "comments_siteId_targetType_targetId_idx" ON "comments"("siteId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "comments_siteId_status_idx" ON "comments"("siteId", "status");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- AddForeignKey
ALTER TABLE "agent_consent" ADD CONSTRAINT "agent_consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
