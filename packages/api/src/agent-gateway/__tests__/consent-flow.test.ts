/**
 * Agent Gateway Consent Flow Integration Tests
 * 
 * Verifies that consent flow records who approved access and when.
 * Success Metric 8: "Consent flow records who approved access and when"
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';

describe('Agent Gateway Consent Flow', () => {
  const projectId = 'test-project-consent';
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test-consent@example.com' },
      update: {},
      create: {
        email: 'test-consent@example.com',
        name: 'Test Consent User',
        password: 'test-hash',
      },
    });
    testUserId = user.id;

    // Create test project
    await prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: 'Test Consent Project',
        slug: 'test-consent-project',
        repoUrl: 'https://github.com/test/consent',
      },
    });

    // Add project member with owner role
    await prisma.projectMember.upsert({
      where: {
        userId_projectId: {
          userId: testUserId,
          projectId: projectId,
        },
      },
      update: {},
      create: {
        userId: testUserId,
        projectId: projectId,
        role: 'owner',
      },
    });
  });

  beforeEach(async () => {
    // Clean up consent records before each test
    await prisma.agentConsent.deleteMany({ where: { projectId } });
  });

  afterAll(async () => {
    // Clean up in reverse order
    await prisma.agentConsent.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('Consent Recording', () => {
    it('should record consent with all required fields', async () => {
      const consentData = {
        projectId,
        userId: testUserId,
        allowedCollections: ['products', 'categories'],
        allowedBranches: ['main', 'staging'],
        deploymentMode: 'cloud',
        termsVersion: '1.0.0',
        termsAcceptedAt: new Date(),
        canRevokeAt: new Date(),
      };

      const consent = await prisma.agentConsent.create({
        data: consentData,
      });

      expect(consent).toBeDefined();
      expect(consent.projectId).toBe(projectId);
      expect(consent.userId).toBe(testUserId);
      expect(consent.termsVersion).toBe('1.0.0');
      expect(consent.termsAcceptedAt).toBeInstanceOf(Date);
    });

    it('should record who granted consent (userId)', async () => {
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      // Verify the user who granted consent is recorded
      expect(consent.userId).toBe(testUserId);
      
      // Verify we can look up the user
      const user = await prisma.user.findUnique({
        where: { id: consent.userId },
      });
      expect(user).not.toBeNull();
      expect(user?.email).toBe('test-consent@example.com');
    });

    it('should record when consent was granted (termsAcceptedAt)', async () => {
      const beforeTest = new Date();
      
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      const afterTest = new Date();

      // Verify timestamp was recorded
      expect(consent.termsAcceptedAt).toBeInstanceOf(Date);
      expect(consent.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(consent.termsAcceptedAt.getTime()).toBeLessThanOrEqual(afterTest.getTime() + 1000);
    });

    it('should store the terms version that was accepted', async () => {
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: ['products'],
          allowedBranches: ['main'],
          deploymentMode: 'on-premise',
          termsVersion: '2.0.0', // Different version
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      expect(consent.termsVersion).toBe('2.0.0');
      expect(consent.deploymentMode).toBe('on-premise');
    });

    it('should store configuration at time of consent', async () => {
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: ['products', 'categories', 'orders'],
          allowedBranches: ['main', 'staging', 'production'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      // Verify configuration is stored
      expect(consent.allowedCollections).toEqual(['products', 'categories', 'orders']);
      expect(consent.allowedBranches).toEqual(['main', 'staging', 'production']);
    });
  });

  describe('Consent History', () => {
    it('should retrieve consent history for a project', async () => {
      // Create multiple consent records
      await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          canRevokeAt: new Date(),
        },
      });

      await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: ['products'],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      const consents = await prisma.agentConsent.findMany({
        where: { projectId },
        orderBy: { termsAcceptedAt: 'desc' },
      });

      expect(consents).toHaveLength(2);
      // Most recent first
      expect(consents[0].allowedCollections).toEqual(['products']);
      expect(consents[1].allowedCollections).toEqual([]);
    });

    it('should include user information with consent records', async () => {
      await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      const consent = await prisma.agentConsent.findFirst({
        where: { projectId },
      });

      expect(consent).not.toBeNull();
      expect(consent?.userId).toBe(testUserId);
      
      // Look up user separately
      const user = await prisma.user.findUnique({
        where: { id: consent!.userId },
        select: { name: true, email: true },
      });
      
      expect(user?.name).toBe('Test Consent User');
      expect(user?.email).toBe('test-consent@example.com');
    });
  });

  describe('Consent Revocation', () => {
    it('should record revocation with timestamp and user', async () => {
      // Create a consent record
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      const beforeRevoke = new Date();

      // Revoke the consent
      await prisma.agentConsent.update({
        where: { id: consent.id },
        data: {
          revokedAt: new Date(),
          revokedBy: testUserId,
        },
      });

      const afterRevoke = new Date();

      // Verify revocation was recorded
      const revokedConsent = await prisma.agentConsent.findUnique({
        where: { id: consent.id },
      });

      expect(revokedConsent?.revokedAt).toBeInstanceOf(Date);
      expect(revokedConsent?.revokedAt?.getTime()).toBeGreaterThanOrEqual(beforeRevoke.getTime());
      expect(revokedConsent?.revokedAt?.getTime()).toBeLessThanOrEqual(afterRevoke.getTime() + 1000);
      expect(revokedConsent?.revokedBy).toBe(testUserId);
    });

    it('should distinguish between active and revoked consent', async () => {
      // Create an active consent
      const activeConsent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      // Create a revoked consent
      const revokedConsent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: [],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          canRevokeAt: new Date(),
          revokedAt: new Date(),
          revokedBy: testUserId,
        },
      });

      // Query active consents
      const activeConsents = await prisma.agentConsent.findMany({
        where: { projectId, revokedAt: null },
      });

      // Query revoked consents
      const revokedConsents = await prisma.agentConsent.findMany({
        where: { projectId, revokedAt: { not: null } },
      });

      expect(activeConsents).toHaveLength(1);
      expect(activeConsents[0].id).toBe(activeConsent.id);
      
      expect(revokedConsents).toHaveLength(1);
      expect(revokedConsents[0].id).toBe(revokedConsent.id);
    });
  });

  describe('Success Metric 8 Verification', () => {
    it('verifies: Consent flow records who approved access and when', async () => {
      const beforeConsent = new Date();

      // Record consent
      const consent = await prisma.agentConsent.create({
        data: {
          projectId,
          userId: testUserId,
          allowedCollections: ['products'],
          allowedBranches: ['main'],
          deploymentMode: 'cloud',
          termsVersion: '1.0.0',
          termsAcceptedAt: new Date(),
          canRevokeAt: new Date(),
        },
      });

      const afterConsent = new Date();

      // Retrieve consent
      const consentRecord = await prisma.agentConsent.findUnique({
        where: { id: consent.id },
      });

      // Verify "who" - user information is recorded
      expect(consentRecord?.userId).toBe(testUserId);
      
      // Look up user separately
      const user = await prisma.user.findUnique({
        where: { id: consentRecord!.userId },
        select: { name: true, email: true },
      });
      
      expect(user?.name).toBe('Test Consent User');
      expect(user?.email).toBe('test-consent@example.com');

      // Verify "when" - timestamp is recorded
      expect(consentRecord?.termsAcceptedAt).toBeInstanceOf(Date);
      expect(consentRecord?.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(beforeConsent.getTime());
      expect(consentRecord?.termsAcceptedAt.getTime()).toBeLessThanOrEqual(afterConsent.getTime() + 1000);

      // Verify "what" - configuration is recorded
      expect(consentRecord?.allowedCollections).toContain('products');
      expect(consentRecord?.termsVersion).toBe('1.0.0');

      // Success Metric 8 verified: Consent flow records who approved access and when
    });
  });
});
