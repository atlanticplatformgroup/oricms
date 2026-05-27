-- CreateEnum
CREATE TYPE "SiteRole" AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CdnExportStatus" AS ENUM ('pending', 'uploading', 'invalidating', 'completed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "githubId" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "repoProvider" TEXT NOT NULL DEFAULT 'github',
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "description" TEXT,
    "avatarUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_members" (
    "id" TEXT NOT NULL,
    "role" "SiteRole" NOT NULL DEFAULT 'viewer',
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "SiteRole" NOT NULL DEFAULT 'editor',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_git_configs" (
    "id" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "tokenProvider" TEXT NOT NULL DEFAULT 'github',
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_git_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "siteId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" TEXT NOT NULL,
    "status" "BuildStatus" NOT NULL DEFAULT 'pending',
    "branch" TEXT NOT NULL,
    "commit" TEXT NOT NULL,
    "commitMessage" TEXT NOT NULL,
    "commitAuthor" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "logs" TEXT,
    "outputUrl" TEXT,
    "outputPath" TEXT,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdn_configs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "region" TEXT,
    "endpoint" TEXT,
    "baseUrl" TEXT,
    "encryptedAccessKey" TEXT NOT NULL,
    "encryptedSecretKey" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdn_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cdn_exports" (
    "id" TEXT NOT NULL,
    "status" "CdnExportStatus" NOT NULL DEFAULT 'pending',
    "sourcePath" TEXT NOT NULL,
    "destinationPrefix" TEXT NOT NULL,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "uploadedFiles" INTEGER NOT NULL DEFAULT 0,
    "failedFiles" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "buildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdn_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_slug_key" ON "sites"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "site_members_userId_siteId_key" ON "site_members"("userId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "site_invites_token_key" ON "site_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "site_git_configs_siteId_key" ON "site_git_configs"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "audit_logs_siteId_createdAt_idx" ON "audit_logs"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "builds_siteId_createdAt_idx" ON "builds"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "builds_siteId_status_idx" ON "builds"("siteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cdn_configs_siteId_key" ON "cdn_configs"("siteId");

-- CreateIndex
CREATE INDEX "cdn_exports_siteId_createdAt_idx" ON "cdn_exports"("siteId", "createdAt");

-- CreateIndex
CREATE INDEX "cdn_exports_siteId_status_idx" ON "cdn_exports"("siteId", "status");

-- AddForeignKey
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_members" ADD CONSTRAINT "site_members_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_invites" ADD CONSTRAINT "site_invites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_invites" ADD CONSTRAINT "site_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_git_configs" ADD CONSTRAINT "site_git_configs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdn_configs" ADD CONSTRAINT "cdn_configs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdn_exports" ADD CONSTRAINT "cdn_exports_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdn_exports" ADD CONSTRAINT "cdn_exports_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
