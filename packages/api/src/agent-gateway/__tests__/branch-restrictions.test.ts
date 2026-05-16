/**
 * Agent Gateway Branch Restrictions Integration Tests
 * 
 * Verifies that branch restrictions limit agent to approved branches only.
 * Success Metric 5: "Branch restrictions limit agent to approved branches only"
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
    // Include branch in key to simulate different branches having different content
    const branchKey = `${branch}:${path}`;
    return this.files.get(branchKey) || this.files.get(path) || null;
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
  
  async getHistory(projectId: string, limit?: number) {
    return [{
      hash: 'abc123',
      message: 'Test commit',
      author: 'Test User',
      date: new Date().toISOString(),
    }];
  },
};

describe('Agent Gateway Branch Restrictions', () => {
  const projectId = 'test-project-branch';
  let testUserId: string;
  let testConfig: AgentAccessConfig;

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.upsert({
      where: { email: 'test-branch@example.com' },
      update: {},
      create: {
        email: 'test-branch@example.com',
        name: 'Test Branch User',
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
        name: 'Test Branch Project',
        slug: 'test-branch-project',
        repoUrl: 'https://github.com/test/branch',
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
    
    // Setup test config with specific allowed branches
    testConfig = {
      projectId,
      enabled: true,
      allowedBranches: ['main', 'staging'], // Only these branches allowed
      allowedCollections: ['products'],
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
        allowedBranches: ['main', 'staging'],
      },
      create: {
        projectId,
        enabled: true,
        allowedBranches: ['main', 'staging'],
        allowedCollections: ['products'],
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

  function createService(projectRole: ProjectRole = 'editor', allowedBranches: string[] = ['main', 'staging']) {
    return new AgentGatewayService({
      projectId,
      agentSessionId: `test-session-${Date.now()}`,
      projectRole,
      config: { ...testConfig, allowedBranches },
      gitService: mockGitService as any,
    });
  }

  describe('Tier 1 Branch Access', () => {
    it('should allow access to allowed branches at Tier 1', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('schemas/product.yaml', `
$schema: content-type-v1
name: product
fields:
  - key: title
    type: string
`);

      // Should succeed for allowed branch
      const result = await service.getContentTypes('main');
      expect(result.data).toHaveLength(1);
    });

    it('should deny access to non-allowed branches at Tier 1', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('schemas/product.yaml', `
$schema: content-type-v1
name: product
`);

      // Should fail for non-allowed branch
      await expect(service.getContentTypes('feature-branch'))
        .rejects.toThrow(AgentAccessError);
    });
  });

  describe('Tier 2 Branch Access', () => {
    it('should allow git history access to allowed branches', async () => {
      const service = createService('editor', ['main', 'staging']);

      // Should succeed for allowed branch
      const result = await service.getGitHistory('main');
      expect(result.data).toBeDefined();
    });

    it('should deny git history access to non-allowed branches', async () => {
      const service = createService('editor', ['main']);

      // Should fail for non-allowed branch
      await expect(service.getGitHistory('production'))
        .rejects.toThrow(AgentAccessError);
    });

    it('should allow repository structure access to allowed branches', async () => {
      const service = createService('editor', ['main']);

      const result = await service.getRepositoryStructure('main');
      expect(result.data).toBeDefined();
    });

    it('should deny repository structure access to non-allowed branches', async () => {
      const service = createService('editor', ['main']);

      await expect(service.getRepositoryStructure('develop'))
        .rejects.toThrow(AgentAccessError);
    });
  });

  describe('Tier 3 Branch Access', () => {
    it('should allow collection access to allowed branches', async () => {
      const service = createService('editor', ['main', 'staging']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should succeed for allowed branch
      const result = await service.getCollectionEntrys('products', {}, contentType, 'main');
      expect(result.data).toHaveLength(1);
    });

    it('should deny collection access to non-allowed branches', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should fail for non-allowed branch
      await expect(
        service.getCollectionEntrys('products', {}, contentType, 'feature-branch')
      ).rejects.toThrow(AgentAccessError);
    });

    it('should allow single record access to allowed branches', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('content/products/single.yaml', `
$id: single
$type: product
title: Single Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      const result = await service.getRecord('products', 'single', contentType, 'main');
      expect(result.data).not.toBeNull();
    });

    it('should deny single record access to non-allowed branches', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('content/products/single.yaml', `
$id: single
$type: product
title: Single Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      await expect(
        service.getRecord('products', 'single', contentType, 'develop')
      ).rejects.toThrow(AgentAccessError);
    });
  });

  describe('Tier 4 Branch Access', () => {
    it('should still enforce branch restrictions at Tier 4', async () => {
      const service = createService('admin', ['main']);
      
      mockGitService.setFile('content/secret/data.yaml', `
$id: data
$type: secret
title: Secret Data
`);

      // Even Tier 4 should be blocked from non-allowed branches
      await expect(service.getRawFile('content/secret/data.yaml', 'unauthorized-branch'))
        .rejects.toThrow(AgentAccessError);
    });

    it('should allow access to allowed branches at Tier 4', async () => {
      const service = createService('admin', ['main', 'develop']);
      
      mockGitService.setFile('content/secret/data.yaml', `
$id: data
$type: secret
title: Secret Data
`);

      const result = await service.getRawFile('content/secret/data.yaml', 'develop');
      expect(result.data).toBeDefined();
    });
  });

  describe('Default Branch Behavior', () => {
    it('should default to main when no branch specified', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should default to 'main' and succeed
      const result = await service.getCollectionEntrys('products', {}, contentType);
      expect(result.data).toHaveLength(1);
    });

    it('should block when main is not in allowed branches', async () => {
      const service = createService('editor', ['staging', 'production']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should fail because 'main' is not in allowed branches
      await expect(
        service.getCollectionEntrys('products', {}, contentType, 'main')
      ).rejects.toThrow(AgentAccessError);
    });
  });

  describe('Branch Name Validation', () => {
    it('should handle branch names with slashes', async () => {
      const service = createService('editor', ['feature/allowed-feature']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should allow branch names with slashes
      const result = await service.getCollectionEntrys('products', {}, contentType, 'feature/allowed-feature');
      expect(result.data).toHaveLength(1);
    });

    it('should reject branch names with path traversal attempts', async () => {
      const service = createService('editor', ['main']);
      
      mockGitService.setFile('content/products/item.yaml', `
$id: item
$type: product
title: Test Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Should reject branch names with path traversal
      await expect(
        service.getCollectionEntrys('products', {}, contentType, '../main')
      ).rejects.toThrow();
    });
  });

  describe('Success Metric 5 Verification', () => {
    it('verifies: Branch restrictions limit agent to approved branches only', async () => {
      const service = createService('editor', ['main', 'staging']);
      
      mockGitService.setFile('content/products/allowed.yaml', `
$id: allowed
$type: product
title: Allowed Item
`);

      const contentType = {
        $schema: 'content-type-v1' as const,
        name: 'product',
        plural: 'products',
        label: 'Product',
        labelPlural: 'Products',
        fields: [{ key: 'title', type: 'string', label: 'Title' }],
      };

      // Allowed branches should work
      const mainResult = await service.getCollectionEntrys('products', {}, contentType, 'main');
      expect(mainResult.data).toHaveLength(1);

      const stagingResult = await service.getCollectionEntrys('products', {}, contentType, 'staging');
      expect(stagingResult.data).toHaveLength(1);

      // Non-allowed branch should be blocked
      await expect(
        service.getCollectionEntrys('products', {}, contentType, 'production')
      ).rejects.toThrow(AgentAccessError);

      await expect(
        service.getCollectionEntrys('products', {}, contentType, 'feature-branch')
      ).rejects.toThrow(AgentAccessError);

      // Success Metric 5 verified: Branch restrictions limit agent to approved branches only
    });
  });
});
