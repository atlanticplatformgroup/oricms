import { request } from './core';

export interface Draft {
  id: string;
  pageId: string;
  pagePath: string;
  previewToken: string;
  updatedAt: string;
  createdAt: string;
}

export interface SaveDraftRequest {
  pageId: string;
  pagePath: string;
  content: Record<string, unknown>;
  schemaIds: string[];
}

export async function saveDraft(
  projectId: string,
  data: SaveDraftRequest
): Promise<{ id: string; previewToken: string; updatedAt: string }> {
  return request<{ id: string; previewToken: string; updatedAt: string }>(`/api/v1/projects/${projectId}/drafts`, {
    method: 'POST',
    body: data,
  });
}

export async function listDrafts(projectId: string): Promise<Draft[]> {
  return request<Draft[]>(`/api/v1/projects/${projectId}/drafts`);
}

export async function deleteDraft(projectId: string, pageId: string): Promise<void> {
  await request(`/api/v1/projects/${projectId}/drafts/${pageId}`, {
    method: 'DELETE',
  });
}

export function getPreviewUrl(environmentUrl: string, previewToken: string, pagePath?: string): string {
  const url = new URL(environmentUrl);
  url.searchParams.set('oricms_preview', previewToken);
  if (pagePath) {
    url.searchParams.set('path', pagePath);
  }
  return url.toString();
}

export async function fetchDraftContent(previewToken: string): Promise<{
  content: unknown;
  pageId: string;
  pagePath: string;
  schemaIds: string[];
  updatedAt: string;
}> {
  return request<{
    content: unknown;
    pageId: string;
    pagePath: string;
    schemaIds: string[];
    updatedAt: string;
  }>(`/api/v1/preview/draft?token=${previewToken}`, {
    requiresAuth: false,
  });
}
