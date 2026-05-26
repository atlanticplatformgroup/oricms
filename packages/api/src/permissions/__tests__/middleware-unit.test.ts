import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { checkPermission, getUserRole, isOwnerOrAdmin, requirePermission, requireOwnerOrAdmin } from '../middleware';
import { apiServices } from '../../lib/api-services';

// Mock apiServices
vi.mock('../../lib/api-services', () => ({
  apiServices: {
    prisma: {
      projectMember: {
        findUnique: vi.fn(),
      },
    },
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  },
}));

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    userId: 'user-1',
    projectId: 'project-1',
    projectRole: undefined,
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

const mockNext = vi.fn() as NextFunction;

describe('checkPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true for owner with any action', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const result = await checkPermission('user-1', 'project-1', 'collections', 'delete');
    expect(result).toBe(true);
  });

  it('should return true for admin with update action', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'admin' });

    const result = await checkPermission('user-1', 'project-1', 'collections', 'update');
    expect(result).toBe(true);
  });

  it('should return false for admin with delete settings action', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'admin' });

    const result = await checkPermission('user-1', 'project-1', 'settings', 'delete');
    expect(result).toBe(false);
  });

  it('should return true for editor with update collections', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'editor' });

    const result = await checkPermission('user-1', 'project-1', 'collections', 'update');
    expect(result).toBe(true);
  });

  it('should return false for editor with update schemas', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'editor' });

    const result = await checkPermission('user-1', 'project-1', 'schemas', 'update');
    expect(result).toBe(false);
  });

  it('should return false for viewer with update action', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'viewer' });

    const result = await checkPermission('user-1', 'project-1', 'collections', 'update');
    expect(result).toBe(false);
  });

  it('should return false for viewer with read action', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'viewer' });

    const result = await checkPermission('user-1', 'project-1', 'collections', 'read');
    expect(result).toBe(false);
  });

  it('should return true for viewer with read assets', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'viewer' });

    const result = await checkPermission('user-1', 'project-1', 'assets', 'read');
    expect(result).toBe(true);
  });

  it('should return false for non-member', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue(null);

    const result = await checkPermission('user-1', 'project-1', 'collections', 'read');
    expect(result).toBe(false);
  });

  it('should normalize pages to collections', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const result = await checkPermission('user-1', 'project-1', 'pages', 'read');
    expect(result).toBe(true);
  });

  it('should normalize content-types to contentTypes', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const result = await checkPermission('user-1', 'project-1', 'content-types', 'read');
    expect(result).toBe(true);
  });

  it('should return false for unknown resource', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const result = await checkPermission('user-1', 'project-1', 'unknown-resource', 'read');
    expect(result).toBe(false);
  });

  it('should use role override when provided', async () => {
    const result = await checkPermission('user-1', 'project-1', 'schemas', 'delete', 'owner');
    expect(result).toBe(true);
    expect(apiServices.prisma.projectMember.findUnique).not.toHaveBeenCalled();
  });
});

describe('getUserRole', () => {
  it('should return role for member', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'admin' });

    const result = await getUserRole('user-1', 'project-1');
    expect(result).toBe('admin');
  });

  it('should return null for non-member', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue(null);

    const result = await getUserRole('user-1', 'project-1');
    expect(result).toBeNull();
  });
});

describe('isOwnerOrAdmin', () => {
  it('should return true for owner', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const result = await isOwnerOrAdmin('user-1', 'project-1');
    expect(result).toBe(true);
  });

  it('should return true for admin', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'admin' });

    const result = await isOwnerOrAdmin('user-1', 'project-1');
    expect(result).toBe(true);
  });

  it('should return false for editor', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'editor' });

    const result = await isOwnerOrAdmin('user-1', 'project-1');
    expect(result).toBe(false);
  });
});

describe('requirePermission middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next when user has permission', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const middleware = requirePermission('collections', 'read');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when userId is missing', async () => {
    const middleware = requirePermission('collections', 'read');
    const req = createMockReq({ userId: undefined });
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 400 when projectId is missing', async () => {
    const middleware = requirePermission('collections', 'read');
    const req = createMockReq({ projectId: undefined, params: {} });
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 for unknown resource', async () => {
    const middleware = requirePermission('unknown-resource', 'read');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 403 when permission denied', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'viewer' });

    const middleware = requirePermission('collections', 'delete');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 500 on error', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockRejectedValue(new Error('DB error'));

    const middleware = requirePermission('collections', 'read');
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('requireOwnerOrAdmin middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next for owner', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'owner' });

    const req = createMockReq();
    const res = createMockRes();

    await requireOwnerOrAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should call next for admin', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'admin' });

    const req = createMockReq();
    const res = createMockRes();

    await requireOwnerOrAdmin(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 401 when userId is missing', async () => {
    const req = createMockReq({ userId: undefined });
    const res = createMockRes();

    await requireOwnerOrAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 403 for editor', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockResolvedValue({ role: 'editor' });

    const req = createMockReq();
    const res = createMockRes();

    await requireOwnerOrAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 500 on error', async () => {
    (apiServices.prisma.projectMember.findUnique as any).mockRejectedValue(new Error('DB error'));

    const req = createMockReq();
    const res = createMockRes();

    await requireOwnerOrAdmin(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
