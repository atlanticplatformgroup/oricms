import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { AgentGatewayService } from '../service';
import type { AgentAccessConfig, ProjectRole } from '@ori/shared';

const mockGitService = {
  files: new Map<string, string>(),

  setFile(filePath: string, content: string) {
    this.files.set(filePath, content);
  },

  async readFile(_projectId: string, filePath: string): Promise<string | null> {
    return this.files.get(filePath) || null;
  },

  async listFilePaths(_projectId: string, directory: string): Promise<string[]> {
    return [...this.files.keys()].filter((filePath) => filePath.startsWith(directory));
  },

  async getHistory() {
    return [
      {
        hash: 'abc123',
        message: 'Test commit',
        author: 'Test User',
        date: new Date().toISOString(),
      },
    ];
  },
};

describe('Agent Gateway Audit Logging', () => {
  const projectId = 'test-project-audit';
  let testUserId: string;
  let testConfig: AgentAccessConfig;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'test-audit@example.com' },
      update: {},
      create: {
        email: 'test-audit@example.com',
        name: 'Test Audit User',
        password: 'test-hash',
      },
    });
    testUserId = user.id;

    await prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: 'Test Audit Project',
        slug: 'test-audit-project',
        repoUrl: 'https://github.com/test/audit',
      },
    });

    await prisma.projectMember.upsert({
      where: {
        userId_projectId: {
          userId: testUserId,
          projectId,
        },
      },
      update: {},
      create: {
        userId: testUserId,
        projectId,
        role: 'owner',
      },
    });

    await prisma.agentAccess.upsert({
      where: { projectId },
      update: {},
      create: {
        projectId,
        enabled: true,
        allowedBranches: ['main'],
        allowedCollections: ['products'],
        historyDepth: 30,
        historyDays: 14,
        deploymentMode: 'cloud',
      },
    });
  });

  beforeEach(async () => {
    await prisma.agentAuditLog.deleteMany({ where: { projectId } });
    mockGitService.files.clear();
    testConfig = {
      projectId,
      enabled: true,
      allowedBranches: ['main'],
      allowedCollections: ['products'],
      historyDepth: 30,
      historyDays: 14,
      deploymentMode: 'cloud',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'test-user',
    };
  });

  afterAll(async () => {
    await prisma.agentAuditLog.deleteMany({ where: { projectId } });
    await prisma.agentAccess.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  function createService(projectRole: ProjectRole): AgentGatewayService {
    return new AgentGatewayService({
      projectId,
      agentSessionId: `test-session-${Date.now()}`,
      projectRole,
      config: testConfig,
      gitService: mockGitService as never,
    });
  }

  it('logs schema reads with the agent role', async () => {
    const service = createService('editor');
    mockGitService.setFile('schemas/article.yaml', `
$schema: content-type-v1
name: article
fields:
  - key: title
    type: string
`);

    await service.getContentType('article', 'main');

    const logs = await prisma.agentAuditLog.findMany({
      where: { projectId, filePath: 'schemas/article.yaml' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.projectRole).toBe('editor');
    expect(logs[0]?.contentRead).toBe(true);
  });

  it('logs git history requests as metadata-only access', async () => {
    const service = createService('editor');

    await service.getGitHistory('main');

    const logs = await prisma.agentAuditLog.findMany({
      where: { projectId, queryType: 'git_history' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.projectRole).toBe('editor');
    expect(logs[0]?.contentRead).toBe(false);
  });

  it('logs each collection entry that is read', async () => {
    const service = createService('editor');
    mockGitService.setFile('content/products/widget.yaml', `
$id: widget
$type: product
title: Widget
price: 99.99
`);
    mockGitService.setFile('content/products/gadget.yaml', `
$id: gadget
$type: product
title: Gadget
price: 49.99
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

    await service.getCollectionEntries('products', {}, contentType, 'main');

    const logs = await prisma.agentAuditLog.findMany({
      where: { projectId },
      orderBy: { timestamp: 'asc' },
    });

    expect(logs).toHaveLength(2);
    expect(logs.every((log) => log.projectRole === 'editor')).toBe(true);
    expect(logs.every((log) => log.contentRead)).toBe(true);
  });

  it('logs redaction metadata for hidden fields', async () => {
    const service = createService('editor');
    mockGitService.setFile('content/products/secret.yaml', `
$id: secret
$type: product
title: Secret Product
costPrice: 10.00
`);

    const contentType = {
      $schema: 'content-type-v1' as const,
      name: 'product',
      plural: 'products',
      label: 'Product',
      labelPlural: 'Products',
      fields: [
        { key: 'title', type: 'string', label: 'Title', agentVisible: true },
        { key: 'costPrice', type: 'number', label: 'Cost Price', agentVisible: false },
      ],
    };

    await service.getEntry('products', 'secret', contentType, 'main');

    const logs = await prisma.agentAuditLog.findMany({
      where: { projectId, filePath: 'content/products/secret.yaml' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.wasRedacted).toBe(true);
    expect(logs[0]?.projectRole).toBe('editor');
  });

  it('logs raw file reads for admin agents', async () => {
    const service = createService('admin');
    mockGitService.setFile('content/pages/about.md', '# About');

    await service.getRawFile('content/pages/about.md', 'main');

    const logs = await prisma.agentAuditLog.findMany({
      where: { projectId, filePath: 'content/pages/about.md' },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]?.projectRole).toBe('admin');
    expect(logs[0]?.contentRead).toBe(true);
  });
});
