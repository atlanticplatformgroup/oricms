import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { ProjectRole } from '@ori/shared';
import { prisma, getPrismaErrorResponse } from '../lib/prisma';
import { sendEmail } from '../lib/email';
import { logger } from '../middleware/logger';
import { buildInviteLink, sendValidationError } from './shared';
import { bootstrapAgentProjectDefaults } from './agent-defaults';
import { ensureResourceNotLocked } from '../locks/middleware';
import { RESOURCE_COLLECTION_IDS } from '../resources/service';

const MEMBERS_LOCK_RESOURCE = {
  resourceType: 'members',
  resourceId: 'project-members',
} as const;

export const MEMBERS_RESOURCE_COLLECTION_ID = RESOURCE_COLLECTION_IDS.members;

type InviteProjectMemberInput = {
  email: string;
  invitedById: string;
  projectId: string;
  role: ProjectRole;
};

type CreateAgentProjectMemberInput = {
  createdBy: string | null;
  expiresInDays?: number;
  name: string;
  projectId: string;
  role: ProjectRole;
};

export async function ensureMembersUnlocked(req: Request, res: Response, projectId: string) {
  return ensureResourceNotLocked(req, res, {
    projectId,
    ...MEMBERS_LOCK_RESOURCE,
  });
}

export function sendMemberValidationError(res: Response, req: Request, message?: string) {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return false;
  }

  sendValidationError(res, errors.mapped(), message);
  return true;
}

export async function listProjectMembers(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true, type: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return members.map((member) => ({
    ...member,
    resourceCollectionId: MEMBERS_RESOURCE_COLLECTION_ID,
  }));
}

export async function createAgentProjectMember(input: CreateAgentProjectMemberInput) {
  let createdUserId: string | null = null;

  try {
    const { createdBy, expiresInDays, name, projectId, role } = input;
    const agentEmail = `agent-${Math.random().toString(36).substring(2, 9)}@oricms.local`;
    const user = await prisma.user.create({
      data: { email: agentEmail, name, type: 'AGENT' },
    });
    createdUserId = user.id;

    const member = await prisma.projectMember.create({
      data: { projectId, userId: user.id, role, userType: 'AGENT' },
      include: { user: { select: { id: true, name: true, email: true, type: true, avatarUrl: true } } },
    });

    await bootstrapAgentProjectDefaults({
      projectId,
      role,
      createdBy,
    });

    const token = `agt_${Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;
    await prisma.agentToken.create({ data: { projectId, userId: user.id, token, name, expiresAt } });

    return { member, token };
  } catch (error) {
    if (createdUserId) {
      await prisma.$transaction([
        prisma.agentToken.deleteMany({ where: { userId: createdUserId } }),
        prisma.user.delete({ where: { id: createdUserId } }),
      ]).catch((cleanupError) => {
        logger.error({ msg: 'Agent member cleanup error', error: cleanupError, userId: createdUserId });
      });
    }

    const prismaError = getPrismaErrorResponse(error);
    if (prismaError) {
      const errorWithCode = new Error(prismaError.message);
      (errorWithCode as Error & { code: string; statusCode: number }).code = prismaError.code;
      (errorWithCode as Error & { code: string; statusCode: number }).statusCode = prismaError.statusCode;
      throw errorWithCode;
    }
    throw error;
  }
}

export async function inviteProjectMember(input: InviteProjectMemberInput) {
  const { email, invitedById, projectId, role } = input;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    const existingMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: existingUser.id, projectId } },
    });

    if (existingMember) {
      return { kind: 'already-member' as const };
    }

    const member = await prisma.projectMember.create({
      data: { projectId, userId: existingUser.id, role },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    return { kind: 'member' as const, member };
  }

  const crypto = await import('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const invite = await prisma.projectInvite.create({
    data: {
      projectId,
      email,
      role,
      invitedById,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const inviteLink = buildInviteLink(token);
  const inviteEmail = await sendEmail({
    to: email,
    subject: 'You were invited to OriCMS',
    text: [
      `You were invited to collaborate on a project in OriCMS as ${role}.`,
      '',
      `Accept invite: ${inviteLink}`,
      '',
      'This invite expires in 7 days.',
    ].join('\n'),
    metadata: { projectId, role, invitedById },
  });

  if (!inviteEmail.delivered) {
    logger.warn({
      msg: 'Invite email was not delivered',
      projectId,
      email,
      mode: inviteEmail.mode,
      error: inviteEmail.error,
    });
  }

  return { kind: 'invite' as const, invite: { ...invite, inviteLink } };
}

export async function validateMemberRoleChange(input: {
  currentUserId: string;
  projectId: string;
  role: string | undefined;
  userId: string;
}) {
  const { currentUserId, projectId, role, userId } = input;

  if (userId === currentUserId) {
    return { ok: false as const, reason: 'self-change' as const };
  }

  if (role === 'owner') {
    const myMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: currentUserId, projectId } },
    });

    if (myMembership?.role !== 'owner') {
      return { ok: false as const, reason: 'owner-transfer-forbidden' as const };
    }
  }

  return { ok: true as const };
}

export function validateMemberRemoval(currentUserId: string, userId: string) {
  if (userId === currentUserId) {
    return { ok: false as const, reason: 'self-remove' as const };
  }

  return { ok: true as const };
}
