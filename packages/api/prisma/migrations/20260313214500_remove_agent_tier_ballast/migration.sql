ALTER TABLE "agent_audit_logs" ALTER COLUMN "accessTier" DROP NOT NULL;

ALTER TABLE "agent_consent" ALTER COLUMN "tier" DROP NOT NULL;
