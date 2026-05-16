import { API_BASE_URL, ApiError, request } from './core';

export interface AgentAuditEntry {
  id: string;
  projectId: string;
  agentSessionId: string;
  action: string;
  filePath: string;
  projectRole: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  wasRedacted: boolean;
  piiPatternsFound: string[];
  contentRead: boolean;
  timestamp: string;
}

export interface AuditSummary {
  totalAccesses: number;
  redactedAccesses: number;
  uniqueFiles: number;
  uniqueSessions: number;
  piiPatternsFound: Record<string, number>;
}

export interface AgentToken {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export const agentApi = {
  async getStatus(projectId: string): Promise<{ enabled: boolean; role: 'owner' | 'admin' | 'editor' | 'viewer'; allowedBranches: string[]; allowedCollections: string[]; historyDepth: number; historyDays: number; deploymentMode: 'cloud' | 'on-premise' }> {
    return request(`/api/v1/agent/v1/admin/config?projectId=${projectId}`);
  },

  async getConfig(projectId: string): Promise<{ enabled: boolean; allowedBranches: string[]; allowedCollections: string[]; historyDepth: number; historyDays: number; deploymentMode: 'cloud' | 'on-premise' }> {
    return request(`/api/v1/agent/v1/admin/config?projectId=${projectId}`);
  },

  async updateConfig(projectId: string, config: { enabled?: boolean; allowedBranches?: string[]; allowedCollections?: string[]; historyDepth?: number; historyDays?: number; deploymentMode?: 'cloud' | 'on-premise' }): Promise<void> {
    return request(`/api/v1/agent/v1/admin/config?projectId=${projectId}`, {
      method: 'PUT',
      body: config,
    });
  },

  async getWriteConfigs(projectId: string): Promise<any[]> {
    return request(`/api/v1/projects/${projectId}/agent/write-config`);
  },

  async updateWriteConfig(projectId: string, collectionName: string, config: any): Promise<void> {
    return request(`/api/v1/projects/${projectId}/agent/write-config/${collectionName}`, {
      method: 'PUT',
      body: config,
    });
  },

  async getChanges(projectId: string, status: string = 'PENDING'): Promise<any[]> {
    return request(`/api/v1/projects/${projectId}/agent/changes?status=${status}`);
  },

  async promoteChanges(projectId: string, changeIds: string[], targetBranch: string = 'main'): Promise<{ promoted: number; conflicts?: any[] }> {
    return request(`/api/v1/projects/${projectId}/agent/promote`, {
      method: 'POST',
      body: { changeIds, targetBranch },
    });
  },

  async listTokens(projectId: string): Promise<{ tokens: AgentToken[] }> {
    return request(`/api/v1/agent/v1/admin/tokens?projectId=${projectId}`);
  },

  async createToken(projectId: string, data: { userId: string; name: string; description?: string; expiresInDays?: number }): Promise<{ id: string; userId?: string; token: string; name: string }> {
    return request('/api/v1/agent/v1/admin/tokens', {
      method: 'POST',
      body: { ...data, projectId },
    });
  },

  async revokeToken(projectId: string, tokenId: string): Promise<{ message: string }> {
    return request(`/api/v1/agent/v1/admin/tokens/${tokenId}/revoke`, {
      method: 'POST',
      body: { projectId },
    });
  },

  async getAuditLogs(projectId: string, query?: { startDate?: string; endDate?: string; action?: string; page?: number; limit?: number }): Promise<{ logs: AgentAuditEntry[]; total: number }> {
    const params = new URLSearchParams();
    params.append('projectId', projectId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    if (query?.action) params.append('action', query.action);
    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('limit', query.limit.toString());
    return request(`/api/v1/agent/v1/admin/audit-log?${params}`);
  },

  async getAuditLog(projectId: string, query?: { startDate?: string; endDate?: string; action?: string; page?: number; limit?: number }): Promise<{ logs: AgentAuditEntry[]; total: number }> {
    return this.getAuditLogs(projectId, query);
  },

  async getAuditSummary(projectId: string, query?: { startDate?: string; endDate?: string }): Promise<AuditSummary> {
    const params = new URLSearchParams();
    params.append('projectId', projectId);
    if (query?.startDate) params.append('startDate', query.startDate);
    if (query?.endDate) params.append('endDate', query.endDate);
    return request(`/api/v1/agent/v1/admin/audit-log/summary?${params}`);
  },

  async exportAuditLogs(projectId: string, startDate: string, endDate: string): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('projectId', projectId);
    params.append('startDate', startDate);
    params.append('endDate', endDate);

    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE_URL}/api/v1/agent/v1/admin/audit-log/export?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new ApiError('Export failed', 'EXPORT_ERROR', response.status);
    }

    return response.blob();
  },
};
