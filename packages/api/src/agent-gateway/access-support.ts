import type { AgentAccessConfig, ProjectRole } from '@ori/shared';
import { logFileAccess, type AuditLogOptions } from './audit';
import { AgentAccessError } from './errors';
import { isCollectionAllowed } from './filter';
import { canReadAgentHistory, canReadAgentRawFiles, canReadAgentSchemas, hasAgentPermission } from './roles';

type GatewayResource =
  | 'schemas'
  | 'assets'
  | 'settings'
  | 'members'
  | 'agents'
  | 'contentTypes'
  | 'collections';

type GatewayAction = 'create' | 'read' | 'update' | 'delete' | 'publish';

export function hasGatewayPermission(
  projectRole: ProjectRole,
  resource: GatewayResource,
  action: GatewayAction,
): boolean {
  return hasAgentPermission(projectRole, resource, action);
}

export function assertCanReadSchemas(projectRole: ProjectRole): void {
  if (!canReadAgentSchemas(projectRole)) {
    throw new AgentAccessError('Schema access requires a role with collection read access');
  }
}

export function assertCanReadCollections(projectRole: ProjectRole): void {
  if (!hasGatewayPermission(projectRole, 'collections', 'read')) {
    throw new AgentAccessError('Collection access requires a role with collection read permission');
  }
}

export function assertCanReadHistory(projectRole: ProjectRole): void {
  if (!canReadAgentHistory(projectRole)) {
    throw new AgentAccessError('History access requires a role with collection read access');
  }
}

export function assertCanReadRawFiles(projectRole: ProjectRole): void {
  if (!canReadAgentRawFiles(projectRole)) {
    throw new AgentAccessError('Raw file access requires an admin or owner role');
  }
}

export function validateAllowedBranch(branch: string, config: AgentAccessConfig): void {
  if (!branch || branch.includes('..') || branch.startsWith('/') || branch.startsWith('\\')) {
    throw new AgentAccessError(`Invalid branch "${branch}"`);
  }

  if (!config.allowedBranches.includes(branch)) {
    throw new AgentAccessError(
      `Branch "${branch}" is not in allowed branches: ${config.allowedBranches.join(', ')}`,
    );
  }
}

export function assertCollectionAllowed(collectionId: string, config: AgentAccessConfig): void {
  if (!isCollectionAllowed(collectionId, config)) {
    throw new AgentAccessError(`Collection '${collectionId}' is not in the allowlist`);
  }
}

export function createGatewayAuditLogger(auditOptions: AuditLogOptions) {
  return {
    async logContentFileAccess(
      filePath: string,
      branch: string,
      contentRead: boolean,
      wasRedacted: boolean,
      piiPatternsFound: string[],
    ): Promise<void> {
      await logFileAccess(auditOptions, {
        filePath,
        branch,
        contentRead,
        wasRedacted,
        piiPatternsFound,
      });
    },

    async auditContentAccess(filePath: string, branch: string, queryType: string): Promise<void> {
      await logFileAccess(auditOptions, {
        filePath,
        branch,
        contentRead: false,
        wasRedacted: false,
        piiPatternsFound: [],
        queryType,
      });
    },
  };
}
