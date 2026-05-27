-- Phase 7: AI Agent Support
-- Creates tables for agent access control, consent, audit logging, and API tokens

-- CreateTable
CREATE TABLE "agent_access" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "allowedBranches" TEXT[] DEFAULT ARRAY['main']::TEXT[],
    "allowedCollections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "historyDepth" INTEGER NOT NULL DEFAULT 30,
    "historyDays" INTEGER NOT NULL DEFAULT 14,
    "deploymentMode" TEXT NOT NULL DEFAULT 'cloud',
    "cloudProvider" TEXT,
    "onPremiseEndpoint" TEXT,
    "onPremiseModel" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "agent_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_consent" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "allowedCollections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedBranches" TEXT[] DEFAULT ARRAY['main']::TEXT[],
    "deploymentMode" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "canRevokeAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agentSessionId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "accessTier" INTEGER NOT NULL,
    "contentRead" BOOLEAN NOT NULL DEFAULT false,
    "wasRedacted" BOOLEAN NOT NULL DEFAULT false,
    "piiPatternsFound" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "queryType" TEXT,
    "diagnosisId" TEXT,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "agent_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "sessionId" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,

    CONSTRAINT "agent_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_access_siteId_key" ON "agent_access"("siteId");

-- CreateIndex
CREATE INDEX "agent_consent_siteId_termsAcceptedAt_idx" ON "agent_consent"("siteId", "termsAcceptedAt");

-- CreateIndex
CREATE INDEX "agent_audit_logs_siteId_timestamp_idx" ON "agent_audit_logs"("siteId", "timestamp");

-- CreateIndex
CREATE INDEX "agent_audit_logs_agentSessionId_idx" ON "agent_audit_logs"("agentSessionId");

-- CreateIndex
CREATE INDEX "agent_audit_logs_siteId_filePath_idx" ON "agent_audit_logs"("siteId", "filePath");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tokens_token_key" ON "agent_tokens"("token");

-- CreateIndex
CREATE INDEX "agent_tokens_siteId_idx" ON "agent_tokens"("siteId");

-- CreateIndex
CREATE INDEX "agent_tokens_token_idx" ON "agent_tokens"("token");

-- AddForeignKey
ALTER TABLE "agent_access" ADD CONSTRAINT "agent_access_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_consent" ADD CONSTRAINT "agent_consent_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_audit_logs" ADD CONSTRAINT "agent_audit_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
