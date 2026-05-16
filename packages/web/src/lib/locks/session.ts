const SESSION_STORAGE_KEY = 'oricms-lock-session-id';

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lock-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function getLockSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server-session';
  }
  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const next = createSessionId();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
}
