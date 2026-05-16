import crypto from 'crypto';
import type { PreparedAgentMutation, InternalAction } from './mutation-types';

export const AGENT_CONFIRMATION_HEADER = 'x-agent-confirmation';

const CONFIRMATION_TTL_MS = 15 * 60 * 1000;

type ConfirmationPayload = {
  principalId: string;
  action: InternalAction;
  collectionName: string;
  entryId?: string;
  payloadFingerprint: string;
  expiresAt: string;
};

function getConfirmationSecret(): string {
  return process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || 'oricms-agent-confirmation-secret';
}

function signValue(value: string): string {
  return crypto.createHmac('sha256', getConfirmationSecret()).update(value).digest('base64url');
}

function createConfirmationToken(payload: ConfirmationPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signValue(encoded)}`;
}

function decodeConfirmationToken(token: string): ConfirmationPayload | null {
  const [encoded, signature] = token.split('.', 2);
  if (!encoded || !signature || signValue(encoded) !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ConfirmationPayload;
  } catch {
    return null;
  }
}

export function buildConfirmationState(params: {
  principalId: string;
  action: InternalAction;
  collectionName: string;
  entryId?: string;
  payloadFingerprint: string;
  requiresConfirmation: boolean;
}): { confirmationToken?: string; confirmationExpiresAt?: string } {
  if (!params.requiresConfirmation) {
    return {};
  }

  const confirmationExpiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS).toISOString();
  return {
    confirmationExpiresAt,
    confirmationToken: createConfirmationToken({
      principalId: params.principalId,
      action: params.action,
      collectionName: params.collectionName,
      ...(params.entryId ? { entryId: params.entryId } : {}),
      payloadFingerprint: params.payloadFingerprint,
      expiresAt: confirmationExpiresAt,
    }),
  };
}

export function assertConfirmationToken(params: {
  token?: string;
  principalId: string;
  prepared: PreparedAgentMutation;
}): { ok: true } | { ok: false; message: string } {
  const { token, principalId, prepared } = params;
  if (!prepared.requiresConfirmation) {
    return { ok: true };
  }

  if (!token) {
    return { ok: false, message: 'This mutation requires an agent confirmation token from preflight' };
  }

  const payload = decodeConfirmationToken(token);
  if (!payload) {
    return { ok: false, message: 'Confirmation token is invalid' };
  }
  if (payload.principalId !== principalId) {
    return { ok: false, message: 'Confirmation token does not belong to this agent principal' };
  }
  if (payload.action !== prepared.internalAction) {
    return { ok: false, message: 'Confirmation token does not match this mutation action' };
  }
  if (payload.collectionName !== prepared.collectionName || payload.entryId !== prepared.entryId) {
    return { ok: false, message: 'Confirmation token does not match this mutation target' };
  }
  if (payload.payloadFingerprint !== prepared.payloadFingerprint) {
    return { ok: false, message: 'Confirmation token does not match this mutation payload' };
  }
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    return { ok: false, message: 'Confirmation token has expired' };
  }

  return { ok: true };
}
