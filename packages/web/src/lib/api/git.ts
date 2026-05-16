import type { GitBranch } from '@ori/shared';
import { request } from './core';

export const gitApi = {
  async getStatus(projectId: string): Promise<{ status: { ahead: number; behind: number; modified: string[]; staged: string[] } }> {
    return request(`/api/v1/projects/${projectId}/git/status`);
  },

  async getBranches(projectId: string): Promise<{ branches: GitBranch[]; current: string | null }> {
    const data = await request<{ branches: GitBranch[]; current: string | null }>(`/api/v1/projects/${projectId}/git/branches`);
    return {
      branches: data.branches || [],
      current: data.current ?? data.branches?.find((branch) => branch.isCurrent)?.name ?? null,
    };
  },

  async compareBranches(
    projectId: string,
    base: string,
    head: string,
  ): Promise<{ base: string; head: string; ahead: number; behind: number }> {
    const params = new URLSearchParams({ base, head });
    return request(`/api/v1/projects/${projectId}/git/branches/compare?${params}`);
  },

  async getBranchDiffSummary(
    projectId: string,
    base: string,
    head: string,
    limit = 200,
  ): Promise<{ base: string; head: string; files: string[]; total: number }> {
    const params = new URLSearchParams({ base, head, limit: String(limit) });
    return request(`/api/v1/projects/${projectId}/git/branches/diff-summary?${params}`);
  },

  async createBranch(
    projectId: string,
    name: string,
    fromBranch?: string,
    headers?: Record<string, string>,
  ): Promise<{ branches: GitBranch[]; current: string | null }> {
    return request(`/api/v1/projects/${projectId}/git/branches`, {
      method: 'POST',
      body: { name, fromBranch },
      headers,
    });
  },

  async renameBranch(
    projectId: string,
    branchName: string,
    newName: string,
    headers?: Record<string, string>,
  ): Promise<{ branch: { name: string }; updatedMappings: number }> {
    return request(`/api/v1/projects/${projectId}/git/branches/${encodeURIComponent(branchName)}`, {
      method: 'PATCH',
      body: { newName },
      headers,
    });
  },

  async deleteBranch(
    projectId: string,
    branchName: string,
    headers?: Record<string, string>,
  ): Promise<{ deleted: boolean; removedMappings: number }> {
    return request(`/api/v1/projects/${projectId}/git/branches/${encodeURIComponent(branchName)}`, {
      method: 'DELETE',
      headers,
    });
  },

  async switchBranch(
    projectId: string,
    name: string,
  ): Promise<{ branches: GitBranch[]; current: string | null }> {
    return request(`/api/v1/projects/${projectId}/git/branches/switch`, {
      method: 'POST',
      body: { name },
    });
  },

  async checkoutBranch(projectId: string, branch: string): Promise<{ branch: string }> {
    const result = await this.switchBranch(projectId, branch);
    return { branch: result.current ?? branch };
  },

  async getCurrentBranch(projectId: string): Promise<{ branch: string }> {
    return request(`/api/v1/projects/${projectId}/git/current-branch`);
  },

  async promoteBranch(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    approvalId: string,
    message?: string,
    headers?: Record<string, string>,
  ): Promise<{
    sourceBranch: string;
    targetBranch: string;
    approvalId: string;
    mergeCommit: { hash: string; message: string };
    comparison: { ahead: number; behind: number };
  }> {
    return request(`/api/v1/projects/${projectId}/git/promote`, {
      method: 'POST',
      body: { sourceBranch, targetBranch, approvalId, message },
      headers,
    });
  },

  async listPromotionRequests(
    projectId: string,
    params?: {
      sourceBranch?: string;
      targetBranch?: string;
      status?: 'pending' | 'approved' | 'consumed' | 'rejected';
      limit?: number;
    },
  ): Promise<{
    requests: Array<{
      id: string;
      sourceBranch: string;
      targetBranch: string;
      requestedByName?: string;
      requestedAt: string;
      status: 'pending' | 'approved' | 'consumed' | 'rejected';
      approvedByName?: string;
      approvedAt?: string;
      rejectedByName?: string;
      rejectedAt?: string;
      consumedAt?: string;
      mergeCommit?: string;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.sourceBranch) searchParams.set('sourceBranch', params.sourceBranch);
    if (params?.targetBranch) searchParams.set('targetBranch', params.targetBranch);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return request(`/api/v1/projects/${projectId}/git/promotions${query ? `?${query}` : ''}`);
  },

  async requestPromotionApproval(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    reason?: string,
    headers?: Record<string, string>,
  ): Promise<{
    request: {
      id: string;
      sourceBranch: string;
      targetBranch: string;
      status: 'pending' | 'approved' | 'consumed' | 'rejected';
    } | null;
  }> {
    return request(`/api/v1/projects/${projectId}/git/promotions/request`, {
      method: 'POST',
      body: { sourceBranch, targetBranch, reason },
      headers,
    });
  },

  async approvePromotionRequest(
    projectId: string,
    requestId: string,
    headers?: Record<string, string>,
  ): Promise<{
    request: {
      id: string;
      sourceBranch: string;
      targetBranch: string;
      status: 'pending' | 'approved' | 'consumed' | 'rejected';
    } | null;
  }> {
    return request(`/api/v1/projects/${projectId}/git/promotions/${requestId}/approve`, {
      method: 'POST',
      headers,
    });
  },

  async rejectPromotionRequest(
    projectId: string,
    requestId: string,
    reason?: string,
    headers?: Record<string, string>,
  ): Promise<{
    request: {
      id: string;
      sourceBranch: string;
      targetBranch: string;
      status: 'pending' | 'approved' | 'consumed' | 'rejected';
    } | null;
  }> {
    return request(`/api/v1/projects/${projectId}/git/promotions/${requestId}/reject`, {
      method: 'POST',
      body: { reason },
      headers,
    });
  },

  async getPromotionConflictFile(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    path: string,
  ): Promise<{
    path: string;
    sourceBranch: string;
    targetBranch: string;
    sourceContent: string;
    targetContent: string;
  }> {
    const params = new URLSearchParams({ sourceBranch, targetBranch, path });
    return request(`/api/v1/projects/${projectId}/git/promotions/conflicts/file?${params}`);
  },

  async resolvePromotionConflicts(
    projectId: string,
    sourceBranch: string,
    targetBranch: string,
    resolutions: Array<{
      path: string;
      strategy: 'source' | 'target' | 'manual';
      content?: string;
    }>,
    headers?: Record<string, string>,
  ): Promise<{ committedFiles: string[] }> {
    return request(`/api/v1/projects/${projectId}/git/promotions/resolve`, {
      method: 'POST',
      body: { sourceBranch, targetBranch, resolutions },
      headers,
    });
  },

  async getCommits(projectId: string, branch?: string, limit?: number): Promise<{ commits: { hash: string; message: string; author: string; date: string }[] }> {
    const params = new URLSearchParams();
    if (branch) params.append('branch', branch);
    if (limit) params.append('limit', limit.toString());
    return request(`/api/v1/projects/${projectId}/git/commits?${params}`);
  },

  async getDiff(projectId: string, path: string, branch?: string): Promise<{ diff: string }> {
    const params = new URLSearchParams();
    params.append('path', path);
    if (branch) params.append('branch', branch);
    return request(`/api/v1/projects/${projectId}/git/diff?${params}`);
  },

  async pull(projectId: string, branch?: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/git/pull`, {
      method: 'POST',
      body: { branch },
    });
  },

  async push(projectId: string, branch?: string): Promise<void> {
    return request(`/api/v1/projects/${projectId}/git/push`, {
      method: 'POST',
      body: { branch },
    });
  },

  async getSchemas(projectId: string): Promise<{ schemas: { name: string; path: string }[] }> {
    return request(`/api/v1/projects/${projectId}/git/schemas`);
  },

  async listTypeSchemas(projectId: string): Promise<{ schemas: { name: string; path: string }[] }> {
    return request(`/api/v1/projects/${projectId}/git/schemas/types`);
  },

  async listComponentSchemas(projectId: string): Promise<{ schemas: { name: string; path: string }[] }> {
    return request(`/api/v1/projects/${projectId}/git/schemas/components`);
  },

  async getTypeSchemas(projectId: string): Promise<{ schemas: { name: string; path: string }[] }> {
    return this.listTypeSchemas(projectId);
  },

  async getComponentSchemas(projectId: string): Promise<{ schemas: { name: string; path: string }[] }> {
    return this.listComponentSchemas(projectId);
  },

  async getSchema(projectId: string, path: string): Promise<{ path: string; content: string }> {
    return request(`/api/v1/projects/${projectId}/git/schemas/${encodeURIComponent(path)}`);
  },

  async saveSchema(projectId: string, path: string, content: string, message?: string, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/git/schemas/${encodeURIComponent(path)}`, {
      method: 'POST',
      body: { content, message },
      headers,
    });
  },

  async deleteSchema(projectId: string, path: string, headers?: Record<string, string>): Promise<void> {
    return request(`/api/v1/projects/${projectId}/git/schemas/${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers,
    });
  },

  async getHistory(projectId: string, limit?: number, path?: string): Promise<{ history: { hash: string; message: string; author: string; date: string }[] }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (path) params.append('path', path);
    return request(`/api/v1/projects/${projectId}/git/history?${params}`);
  },

  async getHistoryDiff(projectId: string, hash: string, path: string): Promise<{ hash: string; path: string; diff: string }> {
    const params = new URLSearchParams({ hash, path });
    return request(`/api/v1/projects/${projectId}/git/history/diff?${params}`);
  },

  async getHistoryFile(projectId: string, hash: string, path: string): Promise<{ hash: string; path: string; content: string }> {
    const params = new URLSearchParams({ hash, path });
    return request(`/api/v1/projects/${projectId}/git/history/file?${params}`);
  },
};
