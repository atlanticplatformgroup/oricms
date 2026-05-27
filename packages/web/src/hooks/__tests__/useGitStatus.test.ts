import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useGitStatus } from '../useGitStatus';

const getStatusMock = vi.fn();
const getBranchesMock = vi.fn();
const compareBranchesMock = vi.fn();
const listBranchMappingsMock = vi.fn();

let mockCurrentProject: { id: string; name: string } | null = { id: 'project-1', name: 'Test' };

vi.mock('../../contexts/useProject', () => ({
  useProject: vi.fn(() => ({ currentProject: mockCurrentProject })),
}));

vi.mock('../../lib/api/git', () => ({
  gitApi: {
    getStatus: (...args: unknown[]) => getStatusMock(...args),
    getBranches: (...args: unknown[]) => getBranchesMock(...args),
    compareBranches: (...args: unknown[]) => compareBranchesMock(...args),
  },
}));

vi.mock('../../lib/api/projects', () => ({
  projectsApi: {
    listBranchMappings: (...args: unknown[]) => listBranchMappingsMock(...args),
  },
}));

describe('useGitStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentProject = { id: 'project-1', name: 'Test' };
  });

  it('returns null status when no project', () => {
    mockCurrentProject = null;
    const { result } = renderHook(() => useGitStatus());
    expect(result.current.status).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('fetches and formats git status', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: ['file.ts'], staged: [], ahead: 2, behind: 1 } });
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'main', isCurrent: true }], current: 'main' });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(result.current.status).not.toBeNull());

    expect(result.current.status).toEqual({
      isClean: false,
      modified: ['file.ts'],
      staged: [],
      branch: 'main',
      ahead: 2,
      behind: 1,
    });
    expect(result.current.loading).toBe(false);
  });

  it('sets merge hint for staging branch', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'staging', isCurrent: true }], current: 'staging' });
    compareBranchesMock.mockResolvedValue({ ahead: 3, behind: 0 });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(result.current.mergeHint).not.toBeNull());

    expect(result.current.mergeHint).toEqual({ label: 'ahead of production', ahead: 3 });
  });

  it('sets merge hint for main branch', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'main', isCurrent: true }], current: 'main' });
    compareBranchesMock.mockResolvedValue({ ahead: 2, behind: 0 });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(result.current.mergeHint).not.toBeNull());

    expect(result.current.mergeHint).toEqual({ label: 'pending from staging', ahead: 2 });
  });

  it('clears merge hint for other branches', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [{ name: 'feature', isCurrent: true }], current: 'feature' });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(result.current.status).not.toBeNull());

    expect(result.current.mergeHint).toBeNull();
  });

  it('loads branch mappings', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [], current: null });
    listBranchMappingsMock.mockResolvedValue({ mappings: [{ branch: 'main', environment: 'production' }] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(result.current.branchMappings).toHaveLength(1));

    expect(result.current.branchMappings).toEqual([{ branch: 'main', environment: 'production' }]);
  });

  it('sets up refresh interval', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [], current: null });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    renderHook(() => useGitStatus());

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(1));

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);

    setIntervalSpy.mockRestore();
  });

  it('exposes refresh function', async () => {
    getStatusMock.mockResolvedValue({ status: { modified: [], staged: [], ahead: 0, behind: 0 } });
    getBranchesMock.mockResolvedValue({ branches: [], current: null });
    listBranchMappingsMock.mockResolvedValue({ mappings: [] });

    const { result } = renderHook(() => useGitStatus());

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(1));

    result.current.refresh();

    await waitFor(() => expect(getStatusMock).toHaveBeenCalledTimes(2));
  });
});
