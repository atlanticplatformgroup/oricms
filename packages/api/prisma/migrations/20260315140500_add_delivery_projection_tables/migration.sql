-- Create delivery projection state for project/branch revisions.
CREATE TABLE "delivery_projection_states" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "recordCount" INTEGER NOT NULL DEFAULT 0,
  "lastProjectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_projection_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_projection_states_projectId_branch_key"
ON "delivery_projection_states"("projectId", "branch");

CREATE INDEX "delivery_projection_states_projectId_branch_revision_idx"
ON "delivery_projection_states"("projectId", "branch", "revision");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    ALTER TABLE "delivery_projection_states"
    ADD CONSTRAINT "delivery_projection_states_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sites'
  ) THEN
    ALTER TABLE "delivery_projection_states"
    ADD CONSTRAINT "delivery_projection_states_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Create projected published-record store.
CREATE TABLE "delivery_projection_records" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "branch" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "contentType" TEXT,
  "slug" TEXT,
  "publishedAt" TEXT,
  "updatedAtSource" TEXT,
  "data" JSONB NOT NULL,
  "projectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "delivery_projection_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_projection_records_projectId_branch_collectionId_entryI_key"
ON "delivery_projection_records"("projectId", "branch", "collectionId", "entryId");

CREATE INDEX "delivery_projection_records_projectId_branch_collectionId_idx"
ON "delivery_projection_records"("projectId", "branch", "collectionId");

CREATE INDEX "delivery_projection_records_projectId_branch_collectionId_slug_idx"
ON "delivery_projection_records"("projectId", "branch", "collectionId", "slug");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) THEN
    ALTER TABLE "delivery_projection_records"
    ADD CONSTRAINT "delivery_projection_records_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'sites'
  ) THEN
    ALTER TABLE "delivery_projection_records"
    ADD CONSTRAINT "delivery_projection_records_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
