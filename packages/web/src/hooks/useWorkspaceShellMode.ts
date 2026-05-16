import { useEffect, useState } from 'react';

const WORKSPACE_MOBILE_MAX_WIDTH = 860;
const WORKSPACE_NARROW_MAX_WIDTH = 1240;

export type WorkspaceShellMode = 'wide' | 'narrow' | 'mobile';

function getWorkspaceShellMode(width: number): WorkspaceShellMode {
  if (width <= WORKSPACE_MOBILE_MAX_WIDTH) return 'mobile';
  if (width <= WORKSPACE_NARROW_MAX_WIDTH) return 'narrow';
  return 'wide';
}

export function useWorkspaceShellMode() {
  const [shellMode, setShellMode] = useState<WorkspaceShellMode>(() => {
    if (typeof window === 'undefined') return 'wide';
    return getWorkspaceShellMode(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setShellMode(getWorkspaceShellMode(window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    shellMode,
    isWideShell: shellMode === 'wide',
    isNarrowShell: shellMode === 'narrow',
    isMobileShell: shellMode === 'mobile',
  };
}
