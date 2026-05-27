-- CreateEnum
CREATE TYPE "AgentWriteMode" AS ENUM ('HUMAN_REVIEW', 'AUTO_PUBLISH', 'BRANCH_BASED');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED', 'AUTO_PUBLISHED');

-- CreateTable
CREATE TABLE "agent_write_configs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "mode" "AgentWriteMode" NOT NULL DEFAULT 'HUMAN_REVIEW',
    "targetBranch" TEXT NOT NULL DEFAULT 'agent/updates',
    "autoMerge" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT true,
    "canUpdate" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "allowedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxWritesPerHour" INTEGER NOT NULL DEFAULT 10,
    "reviewerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireValidation" BOOLEAN NOT NULL DEFAULT true,
    "maxFieldsPerChange" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_write_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_change_requests" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "agentTokenId" TEXT NOT NULL,
    "collectionName" TEXT NOT NULL,
    "recordId" TEXT,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "targetBranch" TEXT NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewComment" TEXT,
    "commitSha" TEXT,
    "pullRequestUrl" TEXT,

    CONSTRAINT "agent_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_environment_mappings" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "branchPattern" TEXT NOT NULL,
    "environmentId" TEXT,
    "autoDeploy" BOOLEAN NOT NULL DEFAULT false,
    "deployOnMerge" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_environment_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_write_configs_siteId_collectionName_key" ON "agent_write_configs"("siteId", "collectionName");

-- CreateIndex
CREATE INDEX "agent_change_requests_siteId_status_idx" ON "agent_change_requests"("siteId", "status");

-- CreateIndex
CREATE INDEX "agent_change_requests_agentTokenId_idx" ON "agent_change_requests"("agentTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "branch_environment_mappings_siteId_branchPattern_key" ON "branch_environment_mappings"("siteId", "branchPattern");
