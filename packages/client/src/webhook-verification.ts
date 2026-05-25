import type {
  VerifyPluginHookRequestInput,
  VerifyPluginHookRequestResult,
  VerifyRevalidationWebhookRequestInput,
  VerifyRevalidationWebhookRequestResult,
} from './client-types.js';

function readHeader(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value[0] || null;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export async function verifyPluginHookRequest(input: VerifyPluginHookRequestInput): Promise<VerifyPluginHookRequestResult> {
  const hookId = readHeader(input.headers, 'x-oricms-hook-id');
  const timestampRaw = readHeader(input.headers, 'x-oricms-hook-timestamp');
  const nonce = readHeader(input.headers, 'x-oricms-hook-nonce');
  const signatureRaw = readHeader(input.headers, 'x-oricms-hook-signature');
  const secretPrefix = readHeader(input.headers, 'x-oricms-hook-secret-prefix');

  if (!hookId || !timestampRaw || !nonce || !signatureRaw) {
    return {
      ok: false,
      code: 'MISSING_HEADERS',
      message: 'Required OriCMS hook headers are missing',
      status: 400,
    };
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Hook timestamp header is invalid',
      status: 400,
    };
  }

  const maxSkewSeconds = input.maxSkewSeconds ?? 300;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxSkewSeconds) {
    return {
      ok: false,
      code: 'TIMESTAMP_OUT_OF_WINDOW',
      message: 'Hook timestamp is outside the accepted replay window',
      status: 401,
    };
  }

  if (!signatureRaw.startsWith('sha256=')) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE_FORMAT',
      message: 'Hook signature header must use sha256= format',
      status: 400,
    };
  }
  const signature = signatureRaw.slice(7);
  const secret = await input.resolveSecret(secretPrefix);
  if (!secret) {
    return {
      ok: false,
      code: 'UNKNOWN_SECRET',
      message: 'No hook secret found for provided secret prefix',
      status: 401,
    };
  }

  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const signedPayload = `${timestampRaw}.${nonce}.${input.rawBody}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'Hook signature validation failed',
      status: 401,
    };
  }

  const replayKey = `${secretPrefix || 'default'}:${hookId}:${nonce}:${timestampRaw}`;
  if (input.hasSeenNonce) {
    const seen = await input.hasSeenNonce(replayKey);
    if (seen) {
      return {
        ok: false,
        code: 'REPLAY_DETECTED',
        message: 'Hook replay detected',
        status: 409,
      };
    }
  }
  if (input.rememberNonce) {
    await input.rememberNonce(replayKey, maxSkewSeconds);
  }

  return {
    ok: true,
    code: 'OK',
    message: 'Hook verified',
    status: 200,
    metadata: {
      hookId,
      timestamp,
      nonce,
      secretPrefix,
      replayKey,
    },
  };
}

export async function verifyRevalidationWebhookRequest(
  input: VerifyRevalidationWebhookRequestInput,
): Promise<VerifyRevalidationWebhookRequestResult> {
  const legacySecret = readHeader(input.headers, 'x-oricms-revalidation-secret');
  const signatureRaw = readHeader(input.headers, 'x-oricms-revalidation-signature');
  const timestampRaw = readHeader(input.headers, 'x-oricms-revalidation-timestamp');

  if (input.allowLegacySecretHeader && legacySecret && legacySecret === input.secret) {
    return {
      ok: true,
      code: 'OK',
      message: 'Revalidation webhook verified via legacy secret header',
      status: 200,
      metadata: {
        timestamp: Math.floor((input.nowMs ?? Date.now()) / 1000),
        replayWindowSeconds: input.maxSkewSeconds ?? 300,
        authMode: 'legacy-secret-header',
      },
    };
  }

  if (!signatureRaw || !timestampRaw) {
    return {
      ok: false,
      code: 'MISSING_HEADERS',
      message: 'Signed revalidation headers are missing',
      status: 400,
    };
  }

  if (!signatureRaw.startsWith('sha256=')) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE_FORMAT',
      message: 'Revalidation signature must use sha256= format',
      status: 400,
    };
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'Revalidation timestamp header is invalid',
      status: 400,
    };
  }

  const maxSkewSeconds = input.maxSkewSeconds ?? 300;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > maxSkewSeconds) {
    return {
      ok: false,
      code: 'TIMESTAMP_OUT_OF_WINDOW',
      message: 'Revalidation timestamp is outside the accepted replay window',
      status: 401,
    };
  }

  const signature = signatureRaw.slice(7);
  const { createHmac, timingSafeEqual } = await import('node:crypto');
  const message = `${timestampRaw}.${input.rawBody}`;
  const expected = createHmac('sha256', input.secret).update(message).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(signature, 'hex');
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'Revalidation signature validation failed',
      status: 401,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: 'Revalidation webhook verified',
    status: 200,
    metadata: {
      timestamp,
      replayWindowSeconds: maxSkewSeconds,
      authMode: 'signed',
    },
  };
}
