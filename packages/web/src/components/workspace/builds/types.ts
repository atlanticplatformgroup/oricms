export type BuildStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type BuildRecord = {
  id: string;
  status: BuildStatus;
  branch: string;
  commit: string;
  commitMessage: string;
  commitAuthor: string;
  triggeredBy: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  outputUrl?: string;
  createdAt: string;
};

export type BuildSummaryCounts = {
  total: number;
  running: number;
  pending: number;
  success: number;
  failed: number;
  cancelled: number;
};

export function mapBuildViewToStatus(view: string): BuildStatus | undefined {
  if (view === 'running') return 'running';
  if (view === 'failed') return 'failed';
  return undefined;
}

export function buildStatusColor(status: BuildStatus): string {
  switch (status) {
    case 'success':
      return 'green';
    case 'failed':
      return 'red';
    case 'running':
      return 'blue';
    case 'pending':
      return 'yellow';
    default:
      return 'gray';
  }
}

export function formatBuildDuration(duration?: number): string {
  if (!duration) return '-';
  const seconds = Math.floor(duration / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
