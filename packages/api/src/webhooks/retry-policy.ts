export interface WebhookRetryPolicy {
  attempts: number;
  timeoutMs: number;
  backoffMs: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function parseIntEnv(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const DEFAULT_POLICY: WebhookRetryPolicy = {
  attempts: 3,
  timeoutMs: 5000,
  backoffMs: 300,
};

export function resolveWebhookRetryPolicy(kind: 'build' | 'revalidation'): WebhookRetryPolicy {
  const prefix = kind === 'build' ? 'BUILD_WEBHOOK' : 'REVALIDATION_WEBHOOK';
  const attempts = parseIntEnv(`${prefix}_RETRY_ATTEMPTS`)
    ?? parseIntEnv('WEBHOOK_RETRY_ATTEMPTS')
    ?? DEFAULT_POLICY.attempts;
  const timeoutMs = parseIntEnv(`${prefix}_TIMEOUT_MS`)
    ?? parseIntEnv('WEBHOOK_TIMEOUT_MS')
    ?? DEFAULT_POLICY.timeoutMs;
  const backoffMs = parseIntEnv(`${prefix}_BACKOFF_MS`)
    ?? parseIntEnv('WEBHOOK_BACKOFF_MS')
    ?? DEFAULT_POLICY.backoffMs;

  return {
    attempts: clamp(attempts, 1, 10),
    timeoutMs: clamp(timeoutMs, 250, 60000),
    backoffMs: clamp(backoffMs, 1, 60000),
  };
}
