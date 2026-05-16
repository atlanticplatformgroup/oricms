import type { AgentAccessConfig, ProjectRole, User } from '@ori/shared';
import type { AgentGatewayService } from '../agent-gateway/service';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
      projectId?: string;
      projectRole?: ProjectRole;
      requestId?: string;
      rawBody?: Buffer;
      agentGateway?: AgentGatewayService;
      agentSessionId?: string;
      agentAccessConfig?: AgentAccessConfig;
      agentTokenId?: string;
    }
  }
}

export {};
