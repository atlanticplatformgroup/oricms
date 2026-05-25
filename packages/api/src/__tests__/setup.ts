/**
 * Test Setup - Vitest configuration
 */

import { vi, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

// Test database URL
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/oricms_test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.ENCRYPTION_KEY = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899';
process.env.NODE_ENV = 'test';

// Mock external services
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/github', () => ({
  getGitHubToken: vi.fn().mockResolvedValue('mock-github-token'),
  getGitHubUser: vi.fn().mockResolvedValue({
    id: '123',
    email: 'test@github.com',
    name: 'Test User',
    avatar_url: 'https://github.com/avatar.png',
  }),
}));

// Clean up after all tests
afterAll(async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  const ignoreMissingTable = async (operation: Promise<unknown>) => {
    try {
      await operation;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2021'
      ) {
        return;
      }

      throw error;
    }
  };

  // Clean up test data. Some local test databases may lag optional tables.
  await ignoreMissingTable(prisma.cdnExport.deleteMany());
  await ignoreMissingTable(prisma.build.deleteMany());
  await ignoreMissingTable(prisma.cdnConfig.deleteMany());
  await ignoreMissingTable(prisma.auditLog.deleteMany());
  await ignoreMissingTable(prisma.projectGitConfig.deleteMany());
  await ignoreMissingTable(prisma.projectInvite.deleteMany());
  await ignoreMissingTable(prisma.projectMember.deleteMany());
  await ignoreMissingTable(prisma.session.deleteMany());
  await ignoreMissingTable(prisma.project.deleteMany());
  await ignoreMissingTable(prisma.user.deleteMany());

  await prisma.$disconnect();
});
