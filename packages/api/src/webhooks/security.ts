import crypto from 'crypto';
import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { normalizeCsvEnv } from '../lib/env';

export type WebhookKind = 'build' | 'revalidation';
export type RevalidationAuthMode = 'none' | 'legacy-secret-header' | 'signed' | 'signed-with-legacy';
export interface WebhookUrlPolicyResult {
  allowed: boolean;
  reason?: string;
}

function hostMatchesPattern(host: string, pattern: string): boolean {
  const normalizedHost = host.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(1);
    return normalizedHost.endsWith(suffix);
  }
  return normalizedHost === normalizedPattern;
}

function resolveAllowedHosts(kind: WebhookKind): Set<string> {
  const globalHosts = normalizeCsvEnv(process.env.WEBHOOK_ALLOWED_HOSTS);
  const specificHosts = normalizeCsvEnv(
    kind === 'build'
      ? process.env.BUILD_WEBHOOK_ALLOWED_HOSTS
      : process.env.REVALIDATION_WEBHOOK_ALLOWED_HOSTS
  );
  if (specificHosts.size > 0) return specificHosts;
  return globalHosts;
}

function resolveAllowInsecureHttp(): boolean {
  if (process.env.WEBHOOK_ALLOW_INSECURE_HTTP === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // fe80::/10
  }
  return false;
}

function isPrivateHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  const ipType = isIP(hostname);
  if (ipType === 4) return isPrivateIPv4(hostname);
  if (ipType === 6) return isPrivateIPv6(hostname);
  return false;
}

function resolveBlockPrivateNetworks(kind: WebhookKind): boolean {
  const specific = kind === 'build'
    ? process.env.BUILD_WEBHOOK_BLOCK_PRIVATE_NETWORKS
    : process.env.REVALIDATION_WEBHOOK_BLOCK_PRIVATE_NETWORKS;
  if (specific === 'true') return true;
  if (specific === 'false') return false;
  return process.env.WEBHOOK_BLOCK_PRIVATE_NETWORKS === 'true';
}

function resolveBlockPrivateDnsResolutions(kind: WebhookKind): boolean {
  const specific = kind === 'build'
    ? process.env.BUILD_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS
    : process.env.REVALIDATION_WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS;
  if (specific === 'true') return true;
  if (specific === 'false') return false;
  return process.env.WEBHOOK_BLOCK_PRIVATE_DNS_RESOLUTIONS === 'true';
}

function resolveDnsCacheTtlMs(): number {
  const raw = Number.parseInt(process.env.WEBHOOK_DNS_CACHE_TTL_MS || '', 10);
  if (Number.isFinite(raw) && raw >= 0) return Math.min(raw, 300000);
  return 30000;
}

const dnsDecisionCache = new Map<string, { expiresAt: number; allowed: boolean; reason?: string }>();

function readDnsCache(key: string): { allowed: boolean; reason?: string } | null {
  const cached = dnsDecisionCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    dnsDecisionCache.delete(key);
    return null;
  }
  return { allowed: cached.allowed, ...(cached.reason ? { reason: cached.reason } : {}) };
}

function writeDnsCache(key: string, value: { allowed: boolean; reason?: string }): void {
  dnsDecisionCache.set(key, {
    expiresAt: Date.now() + resolveDnsCacheTtlMs(),
    allowed: value.allowed,
    reason: value.reason,
  });
}

async function evaluateDnsResolutionPolicy(hostname: string, kind: WebhookKind): Promise<WebhookUrlPolicyResult> {
  if (!resolveBlockPrivateDnsResolutions(kind)) return { allowed: true };
  if (isIP(hostname)) return { allowed: true };

  const cacheKey = `${kind}:${hostname.toLowerCase()}`;
  const cached = readDnsCache(cacheKey);
  if (cached) return cached;

  try {
    const records = await dnsLookup(hostname, { all: true, verbatim: true });
    if (!records || records.length === 0) {
      const result = { allowed: false, reason: 'DNS resolution returned no addresses' };
      writeDnsCache(cacheKey, result);
      return result;
    }

    for (const record of records) {
      if (isPrivateHost(record.address)) {
        const result = { allowed: false, reason: 'DNS resolution includes private-network address' };
        writeDnsCache(cacheKey, result);
        return result;
      }
    }

    const result = { allowed: true };
    writeDnsCache(cacheKey, result);
    return result;
  } catch {
    const result = { allowed: false, reason: 'DNS resolution failed for webhook host' };
    writeDnsCache(cacheKey, result);
    return result;
  }
}

export function __resetWebhookDnsCacheForTests(): void {
  dnsDecisionCache.clear();
}

export async function evaluateWebhookUrlPolicy(rawUrl: string, kind: WebhookKind): Promise<WebhookUrlPolicyResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'Invalid webhook URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'Webhook URL must use http or https' };
  }
  if (parsed.protocol === 'http:' && !resolveAllowInsecureHttp()) {
    return { allowed: false, reason: 'Insecure http webhook URL is blocked in this environment' };
  }
  if (resolveBlockPrivateNetworks(kind) && isPrivateHost(parsed.hostname)) {
    return { allowed: false, reason: 'Webhook host is in private-network range' };
  }

  const allowlist = resolveAllowedHosts(kind);
  if (allowlist.size > 0) {
    const host = parsed.host.toLowerCase();
    let matched = false;
    for (const pattern of allowlist) {
      if (hostMatchesPattern(host, pattern)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      return { allowed: false, reason: 'Webhook host is not in allowlist' };
    }
  }

  return evaluateDnsResolutionPolicy(parsed.hostname, kind);
}

export function isWebhookUrlAllowed(rawUrl: string, kind: WebhookKind): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.protocol === 'http:' && !resolveAllowInsecureHttp()) return false;
  if (resolveBlockPrivateNetworks(kind) && isPrivateHost(parsed.hostname)) return false;

  const allowlist = resolveAllowedHosts(kind);
  if (allowlist.size === 0) return true;

  const host = parsed.host.toLowerCase();
  for (const pattern of allowlist) {
    if (hostMatchesPattern(host, pattern)) return true;
  }
  return false;
}

function normalizeAuthMode(rawValue: string | undefined): RevalidationAuthMode {
  switch ((rawValue || '').trim().toLowerCase()) {
    case 'none':
      return 'none';
    case 'legacy-secret-header':
      return 'legacy-secret-header';
    case 'signed-with-legacy':
      return 'signed-with-legacy';
    case 'signed':
    default:
      return 'signed';
  }
}

export function resolveRevalidationAuthMode(): RevalidationAuthMode {
  return normalizeAuthMode(process.env.REVALIDATION_WEBHOOK_AUTH_MODE);
}

export function buildSignedRevalidationHeaders(secret: string, payload: unknown): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyJson = JSON.stringify(payload);
  const message = `${timestamp}.${bodyJson}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return {
    'x-oricms-revalidation-timestamp': timestamp,
    'x-oricms-revalidation-signature': `sha256=${signature}`,
  };
}
