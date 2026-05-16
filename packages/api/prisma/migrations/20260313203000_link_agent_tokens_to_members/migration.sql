ALTER TABLE "agent_tokens" ADD COLUMN IF NOT EXISTS "userId" TEXT;

CREATE INDEX IF NOT EXISTS "agent_tokens_userId_idx" ON "agent_tokens"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'agent_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "agent_tokens"
      ADD CONSTRAINT "agent_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'project_members'
  ) THEN
    UPDATE "agent_tokens" AS token
    SET "userId" = member."userId"
    FROM "project_members" AS member
    JOIN "users" AS agent_user ON agent_user."id" = member."userId"
    WHERE token."userId" IS NULL
      AND member."projectId" = token."projectId"
      AND member."userType" = 'AGENT'
      AND agent_user."name" = token."name";
  END IF;
END $$;

ALTER TABLE "agent_audit_logs" ADD COLUMN IF NOT EXISTS "projectRole" TEXT;

CREATE INDEX IF NOT EXISTS "agent_audit_logs_projectRole_idx" ON "agent_audit_logs"("projectRole");
