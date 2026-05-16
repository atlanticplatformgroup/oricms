ALTER TABLE "agent_change_requests"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "payloadFingerprint" TEXT,
ADD COLUMN "resultData" JSONB,
ADD COLUMN "confirmationRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "confirmationExpiresAt" TIMESTAMP(3),
ADD COLUMN "confirmedAt" TIMESTAMP(3),
ADD COLUMN "confirmedByPrincipalId" TEXT;

CREATE INDEX "agent_change_requests_siteId_agentTokenId_action_idempotencyKey_idx"
ON "agent_change_requests"("siteId", "agentTokenId", "action", "idempotencyKey");
