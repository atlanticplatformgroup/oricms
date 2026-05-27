import { Router, type Request, type Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../lib/prisma';
import { logger } from '../middleware/logger';
import { badRequest, conflict, created, forbidden, ok, unauthorized } from '../lib/responses';
import { requirePermission } from '../permissions/middleware';
import type { ProjectRole } from '@ori/shared';
import { sendInternalError } from './shared';
import {
  createAgentProjectMember,
  ensureMembersUnlocked,
  inviteProjectMember,
  listProjectMembers,
  MEMBERS_RESOURCE_COLLECTION_ID,
  sendMemberValidationError,
  validateMemberRemoval,
  validateMemberRoleChange,
} from './member-route-support';

const router = Router({ mergeParams: true });

router.get('/:projectId/members', requirePermission('members', 'read'), async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const members = await listProjectMembers(projectId);

    ok(res, {
      members,
      resourceCollectionId: MEMBERS_RESOURCE_COLLECTION_ID,
    });
  } catch (error) {
    logger.error({ msg: 'List members error', error });
    sendInternalError(res, 'Failed to load members');
  }
});

router.post(
  '/:projectId/members/agent',
  requirePermission('members', 'create'),
  [body('name').isString().trim().notEmpty(), body('role').isIn(['admin', 'editor', 'viewer']), body('expiresInDays').optional().isInt({ min: 1 })],
  async (req: Request, res: Response) => {
    try {
      if (sendMemberValidationError(res, req)) {
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureMembersUnlocked(req, res, projectId))) {
        return;
      }
      const { name, role, expiresInDays } = req.body;
      const { member, token } = await createAgentProjectMember({
        projectId,
        name,
        role: role as ProjectRole,
        expiresInDays,
        createdBy: req.userId ?? req.user?.id ?? null,
      });

      created(res, { member, token, message: 'AI Agent created and ready to use' });
    } catch (error) {
      logger.error({ msg: 'Add agent member error', error });
      sendInternalError(res, 'Failed to add agent member');
    }
  },
);

router.post(
  '/:projectId/members',
  requirePermission('members', 'create'),
  [body('email').isEmail(), body('role').isIn(['admin', 'editor', 'viewer'])],
  async (req: Request, res: Response) => {
    try {
      if (sendMemberValidationError(res, req)) {
        return;
      }

      const { projectId } = req.params;
      if (!(await ensureMembersUnlocked(req, res, projectId))) {
        return;
      }
      const { email, role } = req.body;
      if (!req.user) {
        unauthorized(res, 'Authentication required');
        return;
      }
      const invitedById = req.user.id;
      const result = await inviteProjectMember({
        projectId,
        email,
        role: role as ProjectRole,
        invitedById,
      });

      if (result.kind === 'already-member') {
        conflict(res, 'User is already a member of this project', 'ALREADY_MEMBER');
        return;
      }

      if (result.kind === 'member') {
        const { member } = result;
        created(res, { member });
        return;
      }

      created(res, { invite: result.invite });
    } catch (error) {
      logger.error({ msg: 'Invite member error', error });
      sendInternalError(res, 'Failed to invite member');
    }
  },
);

router.patch('/:projectId/members/:userId', requirePermission('members', 'update'), async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;
    if (!(await ensureMembersUnlocked(req, res, projectId))) {
      return;
    }
    const { role } = req.body;
    if (!req.user) {
      unauthorized(res, 'Authentication required');
      return;
    }
    const currentUserId = req.user.id;

    const validation = await validateMemberRoleChange({
      projectId,
      userId,
      currentUserId,
      role,
    });

    if (!validation.ok && validation.reason === 'self-change') {
      badRequest(res, 'You cannot change your own role', 'CANT_CHANGE_SELF');
      return;
    }

    if (!validation.ok && validation.reason === 'owner-transfer-forbidden') {
      forbidden(res, 'Only owners can transfer ownership');
      return;
    }

    const member = await prisma.projectMember.update({
      where: { userId_projectId: { userId, projectId } },
      data: { role: role as ProjectRole },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    ok(res, { member });
  } catch (error) {
    logger.error({ msg: 'Update member error', error });
    sendInternalError(res, 'Failed to update member');
  }
});

router.delete('/:projectId/members/:userId', requirePermission('members', 'delete'), async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;
    if (!(await ensureMembersUnlocked(req, res, projectId))) {
      return;
    }
    if (!req.user) {
      unauthorized(res, 'Authentication required');
      return;
    }
    const currentUserId = req.user.id;

    const validation = validateMemberRemoval(currentUserId, userId);
    if (!validation.ok) {
      badRequest(res, 'Use leave endpoint to remove yourself', 'CANT_REMOVE_SELF');
      return;
    }

    await prisma.projectMember.delete({ where: { userId_projectId: { userId, projectId } } });
    ok(res, { message: 'Member removed successfully' });
  } catch (error) {
    logger.error({ msg: 'Remove member error', error });
    sendInternalError(res, 'Failed to remove member');
  }
});

export default router;
