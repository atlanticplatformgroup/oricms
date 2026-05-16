import crypto from 'crypto';
import type { Express, Request } from 'express';
import rateLimit, { MemoryStore, type Store } from 'express-rate-limit';
import { createClient, type RedisClientType } from 'redis';
import { tooManyRequests } from '../lib/responses';
import { logger } from '../middleware/logger';

export type TrustProxySetting = boolean | number | string | string[];

export type RateLimitPolicyName =
  | 'authCredentials'
  | 'authRegistration'
  | 'authSession'
  | 'api'
  | 'delivery'
  | 'agent'
  | 'system'
  | 'webhooks';

type KeyResolver = (req: Request) => string | undefined;

type RateLimitPolicyDefinition = {
  name: RateLimitPolicyName;
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
  keyResolver?: KeyResolver;
};

type RateLimitPolicyOverride = Partial<Omit<RateLimitPolicyDefinition, 'name' | 'keyResolver'>> & {
  keyResolver?: KeyResolver;
};

type RateLimitPolicyMap = Record<RateLimitPolicyName, RateLimitPolicyDefinition>;

export interface RateLimitRuntimeOptions {
  storeMode?: 'auto' | 'memory' | 'redis';
  redisUrl?: string;
  redisPrefix?: string;
  trustProxy?: TrustProxySetting;
  policies?: Partial<Record<RateLimitPolicyName, RateLimitPolicyOverride>>;
}

interface ResolvedRateLimitConfig {
  isProduction: boolean;
  storeMode: 'memory' | 'redis';
  redisUrl?: string;
  redisPrefix: string;
  trustProxy: TrustProxySetting;
  policies: RateLimitPolicyMap;
}

export interface RateLimitRuntime {
  readonly trustProxy: TrustProxySetting;
  readonly middleware: Record<RateLimitPolicyName, ReturnType<typeof rateLimit>>;
  shutdown(): Promise<void>;
}

const REDIS_INCREMENT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { current, ttl }
`;

function stableFingerprint(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function normalizeIpAddress(ip: string | undefined): string {
  if (!ip) return 'unknown';
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}

function parseBearerToken(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('Bearer ')) return undefined;
  const token = value.slice(7).trim();
  return token || undefined;
}

function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

function getDeliveryKey(req: Request): string | undefined {
  const headerValue = req.headers['x-oricms-delivery-key'];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return parseBearerToken(req.headers.authorization);
}

function getRefreshToken(req: Request): string | undefined {
  return typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim()
    ? req.body.refreshToken.trim()
    : undefined;
}

function buildClientKey(req: Request, resolver?: KeyResolver): string {
  const parts = [`ip:${normalizeIpAddress(req.ip)}`];
  const identity = resolver?.(req);
  if (identity) {
    parts.push(identity);
  }

  return parts.join('|');
}

function hashKeyForLogs(key: string): string {
  return stableFingerprint(key);
}

function defaultPolicyDefinitions(isProduction: boolean): RateLimitPolicyMap {
  return {
    authCredentials: {
      name: 'authCredentials',
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 10 : 1000,
      message: 'Too many authentication attempts. Please try again later.',
      skipSuccessfulRequests: true,
      keyResolver: (req) => {
        const email = normalizeEmail(req.body?.email);
        if (email) return `email:${email}`;
        const token = parseBearerToken(req.headers.authorization);
        return token ? `token:${stableFingerprint(token)}` : undefined;
      },
    },
    authRegistration: {
      name: 'authRegistration',
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 20 : 1000,
      message: 'Too many account or token requests. Please try again later.',
      keyResolver: (req) => {
        const email = normalizeEmail(req.body?.email);
        if (email) return `email:${email}`;
        const refreshToken = getRefreshToken(req);
        if (refreshToken) return `refresh:${stableFingerprint(refreshToken)}`;
        const token = parseBearerToken(req.headers.authorization);
        return token ? `token:${stableFingerprint(token)}` : undefined;
      },
    },
    authSession: {
      name: 'authSession',
      windowMs: 60 * 1000,
      limit: isProduction ? 120 : 1000,
      message: 'Too many authentication session requests. Please retry shortly.',
      keyResolver: (req) => {
        const token = parseBearerToken(req.headers.authorization);
        return token ? `token:${stableFingerprint(token)}` : undefined;
      },
    },
    api: {
      name: 'api',
      windowMs: 60 * 1000,
      limit: isProduction ? 300 : 5000,
      message: 'Too many API requests. Please slow down and try again shortly.',
      keyResolver: (req) => {
        const token = parseBearerToken(req.headers.authorization);
        return token ? `token:${stableFingerprint(token)}` : undefined;
      },
    },
    delivery: {
      name: 'delivery',
      windowMs: 60 * 1000,
      limit: isProduction ? 600 : 5000,
      message: 'Too many delivery API requests. Please try again shortly.',
      keyResolver: (req) => {
        const deliveryKey = getDeliveryKey(req);
        return deliveryKey ? `delivery:${stableFingerprint(deliveryKey)}` : undefined;
      },
    },
    agent: {
      name: 'agent',
      windowMs: 60 * 1000,
      limit: isProduction ? 180 : 3000,
      message: 'Too many agent API requests. Please retry shortly.',
      keyResolver: (req) => {
        const token = parseBearerToken(req.headers.authorization);
        return token ? `agent:${stableFingerprint(token)}` : undefined;
      },
    },
    system: {
      name: 'system',
      windowMs: 60 * 1000,
      limit: isProduction ? 120 : 1000,
      message: 'Too many system status requests. Please retry shortly.',
    },
    webhooks: {
      name: 'webhooks',
      windowMs: 60 * 1000,
      limit: isProduction ? 300 : 3000,
      message: 'Too many webhook deliveries. Please retry shortly.',
    },
  };
}

function resolveStoreMode(
  mode: RateLimitRuntimeOptions['storeMode'],
  redisUrl: string | undefined,
  isProduction: boolean,
): 'memory' | 'redis' {
  if (mode === 'redis') {
    if (!redisUrl) {
      throw new Error('RATE_LIMIT_STORE=redis requires RATE_LIMIT_REDIS_URL to be configured.');
    }
    return 'redis';
  }

  if (mode === 'memory') {
    if (isProduction) {
      throw new Error(
        'Production API rate limiting requires a shared Redis store. Configure RATE_LIMIT_REDIS_URL instead of RATE_LIMIT_STORE=memory.',
      );
    }
    return 'memory';
  }

  if (redisUrl) {
    return 'redis';
  }

  if (isProduction) {
    throw new Error(
      'Production API rate limiting requires RATE_LIMIT_REDIS_URL so counters are shared across instances.',
    );
  }

  return 'memory';
}

export function parseTrustProxySetting(value: string | undefined): TrustProxySetting {
  if (!value) return false;

  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return trimmed;
}

export function resolveRateLimitConfig(options: RateLimitRuntimeOptions = {}): ResolvedRateLimitConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const redisUrl = options.redisUrl ?? process.env.RATE_LIMIT_REDIS_URL?.trim();
  const storeMode = resolveStoreMode(
    options.storeMode ?? (process.env.RATE_LIMIT_STORE?.trim().toLowerCase() as RateLimitRuntimeOptions['storeMode']) ?? 'auto',
    redisUrl,
    isProduction,
  );
  const trustProxy = options.trustProxy ?? parseTrustProxySetting(process.env.TRUST_PROXY);
  const defaultPolicies = defaultPolicyDefinitions(isProduction);

  const policies = Object.fromEntries(
    Object.entries(defaultPolicies).map(([name, definition]) => {
      const override = options.policies?.[name as RateLimitPolicyName];
      return [
        name,
        {
          ...definition,
          ...override,
          name: definition.name,
          keyResolver: override?.keyResolver ?? definition.keyResolver,
        },
      ];
    }),
  ) as RateLimitPolicyMap;

  return {
    isProduction,
    storeMode,
    redisUrl,
    redisPrefix: options.redisPrefix ?? process.env.RATE_LIMIT_REDIS_PREFIX?.trim() ?? 'oricms:rate-limit',
    trustProxy,
    policies,
  };
}

class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;

  constructor(
    private readonly client: RedisClientType,
    private readonly connectPromise: Promise<void>,
    private readonly windowMs: number,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  private async ready(): Promise<void> {
    await this.connectPromise;
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<{ totalHits: number; resetTime: Date | undefined } | undefined> {
    await this.ready();
    const fullKey = this.fullKey(key);
    const [value, ttl] = await Promise.all([
      this.client.get(fullKey),
      this.client.pTTL(fullKey),
    ]);

    if (!value) {
      return undefined;
    }

    const totalHits = Number(value);
    const ttlMs = ttl > 0 ? ttl : this.windowMs;

    return {
      totalHits,
      resetTime: new Date(Date.now() + ttlMs),
    };
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    await this.ready();
    const result = await this.client.eval(REDIS_INCREMENT_SCRIPT, {
      keys: [this.fullKey(key)],
      arguments: [String(this.windowMs)],
    }) as [number | string, number | string];

    const totalHits = Number(result[0]);
    const ttlMs = Number(result[1]) > 0 ? Number(result[1]) : this.windowMs;

    return {
      totalHits,
      resetTime: new Date(Date.now() + ttlMs),
    };
  }

  async decrement(key: string): Promise<void> {
    await this.ready();
    await this.client.decr(this.fullKey(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.ready();
    await this.client.del(this.fullKey(key));
  }
}

class RateLimitStoreFactory {
  private redisClient?: RedisClientType;
  private connectPromise?: Promise<void>;

  constructor(private readonly config: ResolvedRateLimitConfig) {}

  async initialize(): Promise<void> {
    if (this.config.storeMode !== 'redis') {
      return;
    }

    await this.getConnectPromise();
  }

  createStore(policy: RateLimitPolicyDefinition): Store {
    if (this.config.storeMode === 'redis') {
      return new RedisRateLimitStore(
        this.getRedisClient(),
        this.getConnectPromise(),
        policy.windowMs,
        `${this.config.redisPrefix}:${policy.name}:`,
      );
    }

    return new MemoryStore();
  }

  async shutdown(): Promise<void> {
    if (!this.redisClient?.isOpen) {
      return;
    }

    await this.redisClient.quit();
  }

  private getRedisClient(): RedisClientType {
    if (!this.redisClient) {
      this.redisClient = createClient({
        url: this.config.redisUrl,
      });

      this.redisClient.on('error', (error) => {
        logger.error({ msg: 'Rate limit Redis client error', error });
      });
    }

    return this.redisClient;
  }

  private getConnectPromise(): Promise<void> {
    if (!this.connectPromise) {
      this.connectPromise = this.getRedisClient().connect().then(() => {
        logger.info({
          msg: 'Rate limit Redis store connected',
          prefix: this.config.redisPrefix,
        });
      });
    }

    return this.connectPromise;
  }
}

function logRateLimitConfiguration(config: ResolvedRateLimitConfig): void {
  logger.info({
    msg: 'API rate limiting configured',
    storeMode: config.storeMode,
    trustProxy: config.trustProxy,
    policies: Object.fromEntries(
      Object.entries(config.policies).map(([name, policy]) => [
        name,
        { limit: policy.limit, windowMs: policy.windowMs },
      ]),
    ),
  });

  if (config.isProduction && config.trustProxy === false) {
    logger.warn({
      msg: 'TRUST_PROXY is disabled in production. Configure it if the API is deployed behind a reverse proxy or load balancer.',
    });
  }
}

function buildLimiter(policy: RateLimitPolicyDefinition, store: Store): ReturnType<typeof rateLimit> {
  const keyGenerator = (req: Request) => buildClientKey(req, policy.keyResolver);

  return rateLimit({
    windowMs: policy.windowMs,
    limit: policy.limit,
    store,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    identifier: policy.name,
    skipSuccessfulRequests: policy.skipSuccessfulRequests ?? false,
    keyGenerator,
    handler: (req, res, _next, options) => {
      const rateLimitInfo = (req as Request & { rateLimit?: { limit: number; used: number; remaining: number } }).rateLimit;
      logger.warn({
        msg: 'API rate limit exceeded',
        policy: policy.name,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        keyFingerprint: hashKeyForLogs(keyGenerator(req)),
        limit: rateLimitInfo?.limit ?? options.limit,
        used: rateLimitInfo?.used,
        remaining: rateLimitInfo?.remaining,
      });
      tooManyRequests(res, policy.message);
    },
  });
}

export function applyTrustProxy(app: Express, trustProxy: TrustProxySetting): void {
  app.set('trust proxy', trustProxy);
}

export async function createRateLimitRuntime(options: RateLimitRuntimeOptions = {}): Promise<RateLimitRuntime> {
  const config = resolveRateLimitConfig(options);
  const storeFactory = new RateLimitStoreFactory(config);
  await storeFactory.initialize();
  logRateLimitConfiguration(config);

  return {
    trustProxy: config.trustProxy,
    middleware: {
      authCredentials: buildLimiter(
        config.policies.authCredentials,
        storeFactory.createStore(config.policies.authCredentials),
      ),
      authRegistration: buildLimiter(
        config.policies.authRegistration,
        storeFactory.createStore(config.policies.authRegistration),
      ),
      authSession: buildLimiter(
        config.policies.authSession,
        storeFactory.createStore(config.policies.authSession),
      ),
      api: buildLimiter(config.policies.api, storeFactory.createStore(config.policies.api)),
      delivery: buildLimiter(config.policies.delivery, storeFactory.createStore(config.policies.delivery)),
      agent: buildLimiter(config.policies.agent, storeFactory.createStore(config.policies.agent)),
      system: buildLimiter(config.policies.system, storeFactory.createStore(config.policies.system)),
      webhooks: buildLimiter(config.policies.webhooks, storeFactory.createStore(config.policies.webhooks)),
    },
    shutdown: () => storeFactory.shutdown(),
  };
}
