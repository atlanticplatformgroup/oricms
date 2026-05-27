CREATE TABLE "resource_locks" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "branch" TEXT,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "holderType" TEXT NOT NULL,
  "holderId" TEXT NOT NULL,
  "holderName" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "lockTokenHash" TEXT,
  "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "resource_locks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resource_locks_projectId_branch_resourceType_resourceId_exp_idx"
ON "resource_locks"("projectId", "branch", "resourceType", "resourceId", "expiresAt");

CREATE INDEX "resource_locks_projectId_holderId_sessionId_expiresAt_idx"
ON "resource_locks"("projectId", "holderId", "sessionId", "expiresAt");
