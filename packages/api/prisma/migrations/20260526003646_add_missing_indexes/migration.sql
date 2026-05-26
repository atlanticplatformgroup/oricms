-- CreateIndex
CREATE INDEX "agent_access_enabled_idx" ON "agent_access"("enabled");

-- CreateIndex
CREATE INDEX "audit_logs_action_resourceType_resourceId_idx" ON "audit_logs"("action", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "project_invites_projectId_idx" ON "project_invites"("projectId");

-- CreateIndex
CREATE INDEX "project_invites_email_idx" ON "project_invites"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_githubId_idx" ON "users"("githubId");
