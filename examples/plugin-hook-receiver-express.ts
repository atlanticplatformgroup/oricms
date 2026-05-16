import express from 'express';
import { verifyPluginHookRequest } from '@oricms/client';

const app = express();
app.use(express.json({
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));

// Replace with durable shared store (Redis, DB, etc.) in production.
const replayCache = new Map<string, number>();

function getSecretByPrefix(prefix: string | null): string | null {
  if (!prefix) return null;
  // Load from secure storage by prefix lookup.
  const secrets: Record<string, string> = {
    phs_demo1234: 'phs_replace_with_real_secret',
  };
  return secrets[prefix] || null;
}

app.post('/plugin-hooks', async (req: express.Request & { rawBody?: Buffer }, res) => {
  const rawBody = (req.rawBody || Buffer.from(JSON.stringify(req.body || {}))).toString('utf8');

  const verification = await verifyPluginHookRequest({
    headers: req.headers as Record<string, string | string[] | undefined>,
    rawBody,
    resolveSecret: async (prefix) => getSecretByPrefix(prefix),
    hasSeenNonce: (nonceKey) => {
      const expiresAt = replayCache.get(nonceKey);
      if (!expiresAt) return false;
      if (Date.now() >= expiresAt) {
        replayCache.delete(nonceKey);
        return false;
      }
      return true;
    },
    rememberNonce: (nonceKey, ttlSeconds) => {
      replayCache.set(nonceKey, Date.now() + (ttlSeconds * 1000));
    },
  });

  if (!verification.ok) {
    res.status(verification.status).json({
      success: false,
      error: {
        code: verification.code,
        message: verification.message,
      },
    });
    return;
  }

  res.json({
    success: true,
    received: true,
    hook: req.body?.hook,
  });
});
