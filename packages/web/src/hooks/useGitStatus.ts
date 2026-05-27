import { useState, useEffect, useCallback } from 'react';
import { useProject } from '../contexts/useProject';
import { gitApi } from '../lib/api/git';
import { projectsApi } from '../lib/api/projects';
import type { BranchEnvironmentMapping } from '@ori/shared';

export interface GitStatus {
  isClean: boolean;
  modified: string[];
  staged: string[];
  branch: string;
  ahead: number;
  behind: number;
}

export function useGitStatus() {
  const { currentProject } = useProject();
  const projectId = currentProject?.id ?? null;
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branchMappings, setBranchMappings] = useState<BranchEnvironmentMapping[]>([]);
  const [mergeHint, setMergeHint] = useState<{ label: string; ahead: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const [statusResult, branchesResult] = await Promise.all([
        gitApi.getStatus(projectId),
        gitApi.getBranches(projectId),
      ]);
      
      const newStatus = {
        isClean: statusResult.status.modified.length === 0 && statusResult.status.staged.length === 0,
        modified: statusResult.status.modified || [],
        staged: statusResult.status.staged || [],
        branch: branchesResult.current || 'main',
        ahead: statusResult.status.ahead || 0,
        behind: statusResult.status.behind || 0,
      };
      
      setStatus(newStatus);

      if (branchesResult.current) {
        const lowerCurrent = branchesResult.current.toLowerCase();
        if (lowerCurrent === 'staging') {
          const comparison = await gitApi.compareBranches(projectId, 'main', 'staging');
          setMergeHint({
            label: 'ahead of production',
            ahead: comparison.ahead,
          });
        } else if (lowerCurrent === 'main') {
          const comparison = await gitApi.compareBranches(projectId, 'main', 'staging');
          setMergeHint({
            label: 'pending from staging',
            ahead: comparison.ahead,
          });
        } else {
          setMergeHint(null);
        }
      } else {
        setMergeHint(null);
      }
    } catch (error) {
      console.warn('Failed to fetch git status:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadBranchMappings = useCallback(async () => {
    if (!projectId) return;
    try {
      const { mappings } = await projectsApi.listBranchMappings(projectId);
      setBranchMappings(mappings);
    } catch {
      setBranchMappings([]);
    }
  }, [projectId]);

  useEffect(() => {
    fetchStatus();
    loadBranchMappings();
  }, [fetchStatus, loadBranchMappings]);

  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return {
    status,
    branchMappings,
    mergeHint,
    loading,
    refresh: fetchStatus,
  };
}
