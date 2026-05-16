/**
 * Agent Gateway Collection Allowlist Integration Tests
 * 
 * Verifies that collection allowlist prevents access to non-approved collections.
 * Success Metric 4: "Collection allowlist prevents access to non-approved collections"
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { AgentGatewayService, AgentAccessError } from '../service';
import type { AgentAccessConfig, ProjectRole } from '@ori/shared';

// Mock git service
const mockGitService = {
  files: new Map<string, string>(),
  
  setFile(path: string, content: string) {
    this.files.set(path, content);
  },
  
  async readFile(projectId: string, path: string, branch?: string): Promise<string | null> {
    return this.files.get(path) || null;
  },
  
  async listFilePaths(projectId: string, directory: string, branch?: string): Promise<string[]> {
    const paths: string[] = [];
    for (const [path] of this.files) {
      if (path.startsWith(directory)) {
        paths.push(path);
      }
    }
    return paths;
  },
};

describe('Agent Gateway Collection Allowlist', () => {
  const projectId = 'test-project-allowlist';
  let testUserId: string;
  let testConfig: AgentAccessConfig;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test-allowlist@example.com' },
      update: {},
      create: {
        email: 'test-allowlist@example.com',
        name: 'Test Allowlist User',
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
        name: 'Test Allowlist Project',
        slug: 'test-allowlist-project',
        repoUrl: 'https://github.com/test/allowlist',
      },
    });

    // Add project member
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
    // Clear audit logs
    await prisma.agentAuditLog.deleteMany({ where: { projectId } });
    
    // Reset mock files
    mockGitService.files.clear();
    
    // Setup test config with specific allowlist
    testConfig = {
      projectId,
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['products', 'categories'], // Only these collections allowed
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
    };

    // Create/update agent access config
    await prisma.agentAccess.upsert({
      where: { projectId },
      update: {
        allowedCollections: ['products', 'categories'],
      },
      create: {
        projectId,
        enabled: true,
        allowedBranches: ['main'],
        allowedCollections: ['products', 'categories'],
        historyDepth: 30,
        historyDays: 14,
        deploymentMode: 'cloud',
      },
    });
  });

  afterAll(async () => {
    // Clean up in reverse order
    await prisma.agentAuditLog.deleteMany({ where: { projectId } });
    await prisma.agentAccess.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  function createService(projectRole: ProjectRole = 'editor') {
    return new AgentGatewayService({
      projectId,
      agentSessionId: `test-session-${Date.now()}`,
      projectRole,
      config: testConfig,
      gitService: mockGitService as any,
    });
  }

  describe('Tier 3 Collection Access', () => {
    it('should allow access to allowlisted collections', async () => {
      const service = createService('editor');
      
      // Setup allowlisted collection
      mockGitService.setFile('content/products/widget.yaml', `
$id: widget
$type: product
title: Widget
price: 99.99
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should succeed for allowlisted collection
      const result = await service.getCollectionEntrys('products', {}, contentType, 'main');
      
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Widget');
    });

    it('should deny access to non-allowlisted collections', async () => {
      const service = createService('editor');
      
      // Setup non-allowlisted collection
      mockGitService.setFile('content/secrets/internal.yaml', `
$id: internal
$type: secret
title: Secret Data
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'secret',
        plural: 'secrets',
        label: 'Secret',
        labelPlural: 'Secrets',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should throw for non-allowlisted collection
      await expect(
        service.getCollectionEntrys('secrets', {}, contentType, 'main')
      ).rejects.toThrow(AgentAccessError);

      // Verify error message mentions allowlist
      try {
        await service.getCollectionEntrys('secrets', {}, contentType, 'main');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentAccessError);
        expect((error as AgentAccessError).message).toContain("not in the allowlist");
      }
    });

    it('should deny access to single record in non-allowlisted collection', async () => {
      const service = createService('editor');
      
      mockGitService.setFile('content/secrets/secret-item.yaml', `
$id: secret-item
$type: secret
title: Secret Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'secret',
        plural: 'secrets',
        label: 'Secret',
        labelPlural: 'Secrets',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      await expect(
        service.getRecord('secrets', 'secret-item', contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });

    it('should allow access to single record in allowlisted collection', async () => {
      const service = createService('editor');
      
      mockGitService.setFile('content/products/single-item.yaml', `
$id: single-item
$type: product
title: Single Item
price: 50.00
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [
          { key: 'title', type: 'string', label: 'Title' },
          { key: 'price', type: 'number', label: 'Price' },
        ],
      };

      const result = await service.getRecord('products', 'single-item', contentType, 'main');
      
      expect(result.data).not.toBeNull();
      expect(result.data?.title).toBe('Single Item');
      expect(result.data?.price).toBe(50.00);
    });
  });

  describe('Admin Collection Access', () => {
    it('should still enforce the collection allowlist for admin agents', async () => {
      const service = createService('admin');
      
      // Setup non-allowlisted collection
      mockGitService.setFile('content/secrets/top-secret.yaml', `
$id: top-secret
$type: secret
title: Top Secret
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'secret',
        plural: 'secrets',
        label: 'Secret',
        labelPlural: 'Secrets',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      await expect(
        service.getCollectionEntrys('secrets', {}, contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });

    it('should deny single record access to non-allowlisted collections for admin agents', async () => {
      const service = createService('admin');
      
      mockGitService.setFile('content/secrets/confidential.yaml', `
$id: confidential
$type: secret
title: Confidential Data
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'secret',
        plural: 'secrets',
        label: 'Secret',
        labelPlural: 'Secrets',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      await expect(
        service.getRecord('secrets', 'confidential', contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });
  });

  describe('Repository Structure Visibility', () => {
    it('should show allowlist status in repository structure for Tier 3', async () => {
      const service = createService('editor');
      
      // Setup multiple collections
      mockGitService.setFile('content/products/item.yaml', `$id: item\ntitle: Item`);
      mockGitService.setFile('content/categories/cat.yaml', `$id: cat\ntitle: Category`);
      mockGitService.setFile('content/secrets/secret.yaml', `$id: secret\ntitle: Secret`);
      mockGitService.setFile('content/users/user.yaml', `$id: user\ntitle: User`);

      const result = await service.getRepositoryStructure('main');
      
      // Check that collections show their allowlist status
      const collections = result.data.collections;
      
      expect(collections).toContainEqual({
        name: 'products',
        allowed: true,
        count: 1,
      });
      
      expect(collections).toContainEqual({
        name: 'categories',
        allowed: true,
        count: 1,
      });
      
      // Non-allowlisted collections should be visible but marked as not allowed
      const secretsCollection = collections.find(c => c.name === 'secrets');
      expect(secretsCollection).toBeDefined();
      expect(secretsCollection?.allowed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty allowlist - deny all content collections at Tier 3', async () => {
      const restrictedConfig: AgentAccessConfig = {
        ...testConfig,
        allowedCollections: [], // Empty allowlist
      };

      const service = new AgentGatewayService({
        projectId,
        agentSessionId: `test-session-${Date.now()}`,
        projectRole: 'editor',
        config: restrictedConfig,
        gitService: mockGitService as any,
      });
      
      mockGitService.setFile('content/products/item.yaml', `$id: item\ntitle: Item`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Even products should be denied with empty allowlist
      await expect(
        service.getCollectionEntrys('products', {}, contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });

    it('should handle case sensitivity in collection names', async () => {
      const service = createService('editor');
      
      // Setup collection with different case
      mockGitService.setFile('content/Products/item.yaml', `$id: item\ntitle: Item`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // "Products" (capital P) should NOT match "products" in allowlist
      await expect(
        service.getCollectionEntrys('Products', {}, contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });

    it('should not allow traversal attacks via collection name', async () => {
      const service = createService('editor');

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Attempt path traversal in collection name
      await expect(
        service.getCollectionEntrys('../schemas', {}, contentType, 'main')
      ).rejects.toThrow();
    });
  });

  describe('Success Metric 4 Verification', () => {
    it('verifies: Collection allowlist prevents access to non-approved collections', async () => {
      const service = createService('editor');
      
      // Setup both allowlisted and non-allowlisted collections
      mockGitService.setFile('content/products/allowed.yaml', `
$id: allowed
$type: product
title: Allowed Product
`);
      mockGitService.setFile('content/secrets/blocked.yaml', `
$id: blocked
$type: secret
title: Blocked Secret
`);

      const productContentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      const secretContentType = {
        $schema: 'content-type-v1' as const,
        name: 'secret',
        plural: 'secrets',
        label: 'Secret',
        labelPlural: 'Secrets',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Allowlisted collection should work
      const allowedResult = await service.getCollectionEntrys('products', {}, productContentType, 'main');
      expect(allowedResult.data).toHaveLength(1);
      expect(allowedResult.data[0].title).toBe('Allowed Product');

      // Non-allowlisted collection should be blocked
      await expect(
        service.getCollectionEntrys('secrets', {}, secretContentType, 'main')
      ).rejects.toThrow(AgentAccessError);

      // Success Metric 4 verified: Collection allowlist prevents access to non-approved collections
    });
  });
});
