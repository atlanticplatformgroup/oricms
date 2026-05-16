-- AddForeignKey
ALTER TABLE "agent_change_requests" ADD CONSTRAINT "agent_change_requests_agentTokenId_fkey" FOREIGN KEY ("agentTokenId") REFERENCES "agent_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;
