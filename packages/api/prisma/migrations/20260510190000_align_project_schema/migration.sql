-- Align the historical site-based migration chain with the current
-- project-based Prisma schema. This migration is intentionally defensive so it
-- can run on both a fresh migration-only database and local databases that were
-- previously repaired with `prisma db push`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserType') THEN
    CREATE TYPE "UserType" AS ENUM ('HUMAN', 'AGENT');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteRole')
     AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') THEN
    ALTER TYPE "SiteRole" RENAME TO "ProjectRole";
  ELSIF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProjectRole') THEN
    CREATE TYPE "ProjectRole" AS ENUM ('owner', 'admin', 'editor', 'viewer');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.sites') IS NOT NULL
     AND to_regclass('public.projects') IS NULL THEN
    ALTER TABLE "sites" RENAME TO "projects";
  END IF;

  IF to_regclass('public.site_members') IS NOT NULL
     AND to_regclass('public.project_members') IS NULL THEN
    ALTER TABLE "site_members" RENAME TO "project_members";
  END IF;

  IF to_regclass('public.site_invites') IS NOT NULL
     AND to_regclass('public.project_invites') IS NULL THEN
    ALTER TABLE "site_invites" RENAME TO "project_invites";
  END IF;

  IF to_regclass('public.site_git_configs') IS NOT NULL
     AND to_regclass('public.project_git_configs') IS NULL THEN
    ALTER TABLE "site_git_configs" RENAME TO "project_git_configs";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pkey') THEN
    ALTER TABLE "projects" RENAME CONSTRAINT "sites_pkey" TO "projects_pkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_members_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_pkey') THEN
    ALTER TABLE "project_members" RENAME CONSTRAINT "site_members_pkey" TO "project_members_pkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_invites_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_invites_pkey') THEN
    ALTER TABLE "project_invites" RENAME CONSTRAINT "site_invites_pkey" TO "project_invites_pkey";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_git_configs_pkey')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_git_configs_pkey') THEN
    ALTER TABLE "project_git_configs" RENAME CONSTRAINT "site_git_configs_pkey" TO "project_git_configs_pkey";
  END IF;
END $$;

DO $$
DECLARE
  rename_pair text[];
  rename_pairs text[][] := ARRAY[
    ARRAY['project_members', 'siteId', 'projectId'],
    ARRAY['project_invites', 'siteId', 'projectId'],
    ARRAY['project_git_configs', 'siteId', 'projectId'],
    ARRAY['audit_logs', 'siteId', 'projectId'],
    ARRAY['builds', 'siteId', 'projectId'],
    ARRAY['cdn_configs', 'siteId', 'projectId'],
    ARRAY['cdn_exports', 'siteId', 'projectId'],
    ARRAY['agent_access', 'siteId', 'projectId'],
    ARRAY['agent_consent', 'siteId', 'projectId'],
    ARRAY['agent_audit_logs', 'siteId', 'projectId'],
    ARRAY['agent_tokens', 'siteId', 'projectId'],
    ARRAY['agent_write_configs', 'siteId', 'projectId'],
    ARRAY['agent_change_requests', 'siteId', 'projectId'],
    ARRAY['branch_environment_mappings', 'siteId', 'projectId'],
    ARRAY['agent_change_requests', 'recordId', 'entryId']
  ];
BEGIN
  FOREACH rename_pair SLICE 1 IN ARRAY rename_pairs LOOP
    IF to_regclass('public.' || quote_ident(rename_pair[1])) IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = rename_pair[1]
           AND column_name = rename_pair[2]
       )
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = rename_pair[1]
           AND column_name = rename_pair[3]
       ) THEN
      EXECUTE format('ALTER TABLE %I RENAME COLUMN %I TO %I', rename_pair[1], rename_pair[2], rename_pair[3]);
    END IF;
  END LOOP;
END $$;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "type" "UserType" NOT NULL DEFAULT 'HUMAN';

ALTER TABLE "projects"
  ALTER COLUMN "repoUrl" DROP NOT NULL;

ALTER TABLE "project_members"
  ADD COLUMN IF NOT EXISTS "userType" "UserType" NOT NULL DEFAULT 'HUMAN';

ALTER TABLE "agent_change_requests"
  ADD COLUMN IF NOT EXISTS "baseCommitSha" TEXT;

ALTER TABLE "agent_audit_logs"
  ADD COLUMN IF NOT EXISTS "projectRole" TEXT;

UPDATE "cdn_exports" SET "errors" = ARRAY[]::TEXT[] WHERE "errors" IS NULL;
UPDATE "cdn_exports" SET "urls" = ARRAY[]::TEXT[] WHERE "urls" IS NULL;
ALTER TABLE "cdn_exports"
  ALTER COLUMN "errors" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "errors" SET NOT NULL,
  ALTER COLUMN "urls" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "urls" SET NOT NULL;

UPDATE "agent_access" SET "allowedBranches" = ARRAY['main']::TEXT[] WHERE "allowedBranches" IS NULL;
UPDATE "agent_access" SET "allowedCollections" = ARRAY[]::TEXT[] WHERE "allowedCollections" IS NULL;
ALTER TABLE "agent_access"
  ALTER COLUMN "allowedBranches" SET DEFAULT ARRAY['main']::TEXT[],
  ALTER COLUMN "allowedBranches" SET NOT NULL,
  ALTER COLUMN "allowedCollections" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "allowedCollections" SET NOT NULL;

UPDATE "agent_consent" SET "allowedBranches" = ARRAY['main']::TEXT[] WHERE "allowedBranches" IS NULL;
UPDATE "agent_consent" SET "allowedCollections" = ARRAY[]::TEXT[] WHERE "allowedCollections" IS NULL;
ALTER TABLE "agent_consent"
  ALTER COLUMN "allowedBranches" SET DEFAULT ARRAY['main']::TEXT[],
  ALTER COLUMN "allowedBranches" SET NOT NULL,
  ALTER COLUMN "allowedCollections" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "allowedCollections" SET NOT NULL;

UPDATE "agent_audit_logs" SET "piiPatternsFound" = ARRAY[]::TEXT[] WHERE "piiPatternsFound" IS NULL;
ALTER TABLE "agent_audit_logs"
  ALTER COLUMN "piiPatternsFound" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "piiPatternsFound" SET NOT NULL;

UPDATE "agent_write_configs" SET "allowedFields" = ARRAY[]::TEXT[] WHERE "allowedFields" IS NULL;
UPDATE "agent_write_configs" SET "blockedFields" = ARRAY[]::TEXT[] WHERE "blockedFields" IS NULL;
UPDATE "agent_write_configs" SET "reviewerIds" = ARRAY[]::TEXT[] WHERE "reviewerIds" IS NULL;
ALTER TABLE "agent_write_configs"
  ALTER COLUMN "allowedFields" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "allowedFields" SET NOT NULL,
  ALTER COLUMN "blockedFields" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "blockedFields" SET NOT NULL,
  ALTER COLUMN "reviewerIds" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "reviewerIds" SET NOT NULL;

ALTER TABLE "agent_access" DROP COLUMN IF EXISTS "tier";
ALTER TABLE "agent_consent" DROP COLUMN IF EXISTS "tier";
ALTER TABLE "agent_audit_logs" DROP COLUMN IF EXISTS "accessTier";
ALTER TABLE "agent_tokens" DROP COLUMN IF EXISTS "tier";

DROP TABLE IF EXISTS "comments" CASCADE;
DROP TABLE IF EXISTS "drafts" CASCADE;

ALTER INDEX IF EXISTS "sites_slug_key" RENAME TO "projects_slug_key";
ALTER INDEX IF EXISTS "site_members_userId_siteId_key" RENAME TO "project_members_userId_projectId_key";
ALTER INDEX IF EXISTS "site_invites_token_key" RENAME TO "project_invites_token_key";
ALTER INDEX IF EXISTS "site_git_configs_siteId_key" RENAME TO "project_git_configs_projectId_key";
ALTER INDEX IF EXISTS "audit_logs_siteId_createdAt_idx" RENAME TO "audit_logs_projectId_createdAt_idx";
ALTER INDEX IF EXISTS "builds_siteId_createdAt_idx" RENAME TO "builds_projectId_createdAt_idx";
ALTER INDEX IF EXISTS "builds_siteId_status_idx" RENAME TO "builds_projectId_status_idx";
ALTER INDEX IF EXISTS "cdn_configs_siteId_key" RENAME TO "cdn_configs_projectId_key";
ALTER INDEX IF EXISTS "cdn_exports_siteId_createdAt_idx" RENAME TO "cdn_exports_projectId_createdAt_idx";
ALTER INDEX IF EXISTS "cdn_exports_siteId_status_idx" RENAME TO "cdn_exports_projectId_status_idx";
ALTER INDEX IF EXISTS "agent_access_siteId_key" RENAME TO "agent_access_projectId_key";
ALTER INDEX IF EXISTS "agent_consent_siteId_termsAcceptedAt_idx" RENAME TO "agent_consent_projectId_termsAcceptedAt_idx";
ALTER INDEX IF EXISTS "agent_audit_logs_siteId_timestamp_idx" RENAME TO "agent_audit_logs_projectId_timestamp_idx";
ALTER INDEX IF EXISTS "agent_audit_logs_siteId_filePath_idx" RENAME TO "agent_audit_logs_projectId_filePath_idx";
ALTER INDEX IF EXISTS "agent_tokens_siteId_idx" RENAME TO "agent_tokens_projectId_idx";
ALTER INDEX IF EXISTS "agent_write_configs_siteId_collectionName_key" RENAME TO "agent_write_configs_projectId_collectionName_key";
ALTER INDEX IF EXISTS "agent_change_requests_siteId_status_idx" RENAME TO "agent_change_requests_projectId_status_idx";
ALTER INDEX IF EXISTS "agent_change_requests_siteId_agentTokenId_action_idempotencyKey_idx" RENAME TO "agent_change_requests_projectId_agentTokenId_action_idempotencyKey_idx";
ALTER INDEX IF EXISTS "branch_environment_mappings_siteId_branchPattern_key" RENAME TO "branch_environment_mappings_projectId_branchPattern_key";
ALTER INDEX IF EXISTS "agent_change_requests_projectId_agentTokenId_action_idempotency" RENAME TO "agent_change_requests_projectId_agentTokenId_action_idempot_idx";
ALTER INDEX IF EXISTS "delivery_projection_records_projectId_branch_collectionId_entry" RENAME TO "delivery_projection_records_projectId_branch_collectionId_e_key";
ALTER INDEX IF EXISTS "delivery_projection_records_projectId_branch_collectionId_slug_" RENAME TO "delivery_projection_records_projectId_branch_collectionId_s_idx";

DROP INDEX IF EXISTS "agent_audit_logs_projectRole_idx";

ALTER TABLE "delivery_projection_states"
  ALTER COLUMN "updatedAt" DROP DEFAULT;

DO $$
DECLARE
  constraint_pair text[];
  constraint_pairs text[][] := ARRAY[
    ARRAY['project_members', 'site_members_siteId_fkey', 'project_members_projectId_fkey'],
    ARRAY['project_members', 'site_members_userId_fkey', 'project_members_userId_fkey'],
    ARRAY['project_invites', 'site_invites_siteId_fkey', 'project_invites_projectId_fkey'],
    ARRAY['project_invites', 'site_invites_invitedById_fkey', 'project_invites_invitedById_fkey'],
    ARRAY['project_git_configs', 'site_git_configs_siteId_fkey', 'project_git_configs_projectId_fkey'],
    ARRAY['audit_logs', 'audit_logs_siteId_fkey', 'audit_logs_projectId_fkey'],
    ARRAY['builds', 'builds_siteId_fkey', 'builds_projectId_fkey'],
    ARRAY['cdn_configs', 'cdn_configs_siteId_fkey', 'cdn_configs_projectId_fkey'],
    ARRAY['cdn_exports', 'cdn_exports_siteId_fkey', 'cdn_exports_projectId_fkey'],
    ARRAY['agent_access', 'agent_access_siteId_fkey', 'agent_access_projectId_fkey'],
    ARRAY['agent_consent', 'agent_consent_siteId_fkey', 'agent_consent_projectId_fkey'],
    ARRAY['agent_audit_logs', 'agent_audit_logs_siteId_fkey', 'agent_audit_logs_projectId_fkey'],
    ARRAY['agent_tokens', 'agent_tokens_siteId_fkey', 'agent_tokens_projectId_fkey']
  ];
BEGIN
  FOREACH constraint_pair SLICE 1 IN ARRAY constraint_pairs LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_pair[2])
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = constraint_pair[3]) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', constraint_pair[1], constraint_pair[2], constraint_pair[3]);
    END IF;
  END LOOP;
END $$;
