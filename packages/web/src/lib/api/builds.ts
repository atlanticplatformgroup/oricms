import type { BuildRecord, BuildSummaryCounts, PaginationMeta } from '@ori/shared';
import { request } from './core';

export const buildsApi = {
  async list(projectId: string, params?: { status?: string; limit?: number; offset?: number }): Promise<{ builds: BuildRecord[]; pagination: PaginationMeta }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.offset) qs.append('offset', String(params.offset));
    return request(`/api/v1/projects/${projectId}/builds?${qs}`);
  },

  async getSummary(projectId: string): Promise<{ latestBuild?: BuildRecord; counts: BuildSummaryCounts }> {
    return request(`/api/v1/projects/${projectId}/builds/status/summary`);
  },

  async trigger(projectId: string, branch?: string, commit?: string): Promise<{ build: BuildRecord; message: string }> {
    return request(`/api/v1/projects/${projectId}/builds`, { method: 'POST', body: { branch, commit } });
  },

  async cancel(projectId: string, buildId: string): Promise<{ build: BuildRecord; message: string }> {
    return request(`/api/v1/projects/${projectId}/builds/${buildId}/cancel`, { method: 'POST' });
  },
};
