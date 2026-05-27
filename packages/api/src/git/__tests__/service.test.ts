/**
 * Git Service Integration Tests
 *
 * Tests Git operations: clone, status, branches, commits, file operations
 * Uses a temporary git repository for isolation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GitService } from '../service';
import { prisma } from '../../lib/prisma';
import { encrypt } from '../../lib/crypto';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Test configuration
const TEST_WORKSPACE = '/tmp/oricms-git-tests';
const TEST_SOURCE_PATH = path.join(TEST_WORKSPACE, 'source-repo'); // non-bare working repo for setup
const TEST_REPO_PATH = path.join(TEST_WORKSPACE, 'test-repo');     // bare remote (accepts pushes)

describe('GitService Integration', () => {
  let gitService: GitService;
  let testProjectId: string;
  const originalGitAuthorName = process.env.GIT_AUTHOR_NAME;
  const originalGitAuthorEmail = process.env.GIT_AUTHOR_EMAIL;
  const originalGitCommitterName = process.env.GIT_COMMITTER_NAME;
  const originalGitCommitterEmail = process.env.GIT_COMMITTER_EMAIL;

  beforeAll(async () => {
    process.env.GIT_AUTHOR_NAME = 'Test User';
    process.env.GIT_AUTHOR_EMAIL = 'test@example.com';
    process.env.GIT_COMMITTER_NAME = 'Test User';
    process.env.GIT_COMMITTER_EMAIL = 'test@example.com';

    // Create test workspace
    await fs.mkdir(TEST_WORKSPACE, { recursive: true });

    // Build commits in a standard working repo first
    await fs.mkdir(TEST_SOURCE_PATH, { recursive: true });
    execSync('git init --initial-branch=main', { cwd: TEST_SOURCE_PATH });
    execSync('git config user.email "test@example.com"', { cwd: TEST_SOURCE_PATH });
    execSync('git config user.name "Test User"', { cwd: TEST_SOURCE_PATH });

    // Create initial commit
    await fs.writeFile(path.join(TEST_SOURCE_PATH, 'README.md'), '# Test Repo\n');
    execSync('git add README.md', { cwd: TEST_SOURCE_PATH });
    execSync('git commit -m "Initial commit"', { cwd: TEST_SOURCE_PATH });

    // Create content structure
    await fs.mkdir(path.join(TEST_SOURCE_PATH, 'content', 'pages'), { recursive: true });
    await fs.writeFile(
      path.join(TEST_SOURCE_PATH, 'content', 'pages', 'index.md'),
      '---\ntitle: Home\n---\n\n# Welcome\n'
    );
    execSync('git add .', { cwd: TEST_SOURCE_PATH });
    execSync('git commit -m "Add home page"', { cwd: TEST_SOURCE_PATH });

    // Create a bare clone to use as the remote — bare repos accept pushes
    execSync(`git clone --bare "${TEST_SOURCE_PATH}" "${TEST_REPO_PATH}"`);

    gitService = new GitService();
  });

  afterAll(async () => {
    process.env.GIT_AUTHOR_NAME = originalGitAuthorName;
    process.env.GIT_AUTHOR_EMAIL = originalGitAuthorEmail;
    process.env.GIT_COMMITTER_NAME = originalGitCommitterName;
    process.env.GIT_COMMITTER_EMAIL = originalGitCommitterEmail;

    // Cleanup
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create a unique test project for each test
    const timestamp = Date.now();
    const user = await prisma.user.create({
      data: {
        email: `git-test-${timestamp}@example.com`,
        name: 'Git Test User',
      },
    });
    
    const project = await prisma.project.create({
      data: {
        name: `Git Test Project ${timestamp}`,
        slug: `git-test-${timestamp}`,
        repoUrl: `file://${TEST_REPO_PATH}`,
        defaultBranch: 'main',
      },
    });
    
    // Create project membership
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'owner',
      },
    });

    // Create git config for the project with encrypted token
    await prisma.projectGitConfig.create({
      data: {
        projectId: project.id,
        tokenProvider: 'github',
        encryptedToken: encrypt('test-token'),
      },
    });
    
    testProjectId = project.id;
  });

  describe('Repository Operations', () => {
    it('should clone a repository', async () => {
      await gitService.ensureCloned(testProjectId);

      // Use the service's own path resolver so WORKSPACE_ROOT always matches
      const workspacePath = gitService.getWorkspaceDir(testProjectId);
      const stats = await fs.stat(workspacePath);
      expect(stats.isDirectory()).toBe(true);

      // Verify git repo exists
      const gitDir = await fs.stat(path.join(workspacePath, '.git'));
      expect(gitDir.isDirectory()).toBe(true);
    });

    it('should get repository status', async () => {
      const status = await gitService.getStatus(testProjectId);
      
      expect(status).toBeDefined();
      expect(typeof status.ahead).toBe('number');
      expect(typeof status.behind).toBe('number');
      expect(Array.isArray(status.modified)).toBe(true);
      expect(Array.isArray(status.staged)).toBe(true);
    });

    it('should list branches', async () => {
      const branches = await gitService.listBranches(testProjectId);
      
      expect(Array.isArray(branches)).toBe(true);
      expect(branches.length).toBeGreaterThan(0);
      
      const mainBranch = branches.find(b => b.name === 'main');
      expect(mainBranch).toBeDefined();
      expect(mainBranch?.isDefault).toBe(true);
    });

    it('should get commit history', async () => {
      const history = await gitService.getHistory(testProjectId, 10);
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      
      const firstCommit = history[0];
      expect(firstCommit.hash).toBeDefined();
      expect(firstCommit.message).toBeDefined();
      expect(firstCommit.author).toBeDefined();
      expect(firstCommit.date).toBeDefined();
    });

    it('should clone local file repos without git token config', async () => {
      await prisma.projectGitConfig.delete({
        where: { projectId: testProjectId },
      });

      await gitService.ensureCloned(testProjectId);

      const workspacePath = gitService.getWorkspaceDir(testProjectId);
      const gitDir = await fs.stat(path.join(workspacePath, '.git'));
      expect(gitDir.isDirectory()).toBe(true);
    });

    it('should create branches without switching the current branch', async () => {
      const branchName = `staging-${Date.now()}`;
      await gitService.createBranch(testProjectId, branchName, 'main');

      let branches = await gitService.listBranches(testProjectId);
      expect(branches.some((branch) => branch.name === branchName)).toBe(true);
      expect(branches.find((branch) => branch.isCurrent)?.name).toBe('main');

      await gitService.switchBranch(testProjectId, branchName);
      branches = await gitService.listBranches(testProjectId);
      expect(branches.find((branch) => branch.isCurrent)?.name).toBe(branchName);
    });

    it('should compare branches for ahead/behind', async () => {
      const branchName = `staging-compare-${Date.now()}`;
      await gitService.createBranch(testProjectId, branchName, 'main');
      await gitService.switchBranch(testProjectId, branchName);
      await gitService.writeFile(
        testProjectId,
        'content/pages/staging-only.md',
        '---\ntitle: staging\n---\n\nstaging only',
        {
          message: 'Add staging content',
          author: { name: 'Test User', email: 'test@example.com' },
        }
      );

      const comparison = await gitService.compareBranches(testProjectId, 'main', branchName);
      expect(comparison.ahead).toBeGreaterThan(0);
      expect(comparison.behind).toBe(0);
    });

    it('should return diff summary between branches', async () => {
      const branchName = `staging-diff-${Date.now()}`;
      await gitService.createBranch(testProjectId, branchName, 'main');
      await gitService.switchBranch(testProjectId, branchName);
      await gitService.writeFile(
        testProjectId,
        'content/pages/diff-summary.md',
        '---\ntitle: diff\n---\n\ndiff summary',
        {
          message: 'Add diff summary content',
          author: { name: 'Test User', email: 'test@example.com' },
        }
      );

      const summary = await gitService.getBranchDiffSummary(testProjectId, 'main', branchName);
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.files).toContain('content/pages/diff-summary.md');
    });

    it('should handle missing branch in compare without throwing', async () => {
      const comparison = await gitService.compareBranches(testProjectId, 'main', 'staging');
      expect(comparison).toEqual({ ahead: 0, behind: 0 });
    });

    it('should return empty diff summary when branch is missing', async () => {
      const summary = await gitService.getBranchDiffSummary(testProjectId, 'main', 'staging');
      expect(summary).toEqual({ files: [], total: 0 });
    });

    it('should promote staging to main', async () => {
      const branchName = `staging-promote-${Date.now()}`;
      await gitService.createBranch(testProjectId, branchName, 'main');
      await gitService.switchBranch(testProjectId, branchName);
      await gitService.writeFile(
        testProjectId,
        'content/pages/promote-test.md',
        '---\ntitle: promote\n---\n\npromote me',
        {
          message: 'Add promote content',
          author: { name: 'Test User', email: 'test@example.com' },
        }
      );

      const mergeResult = await gitService.promoteBranch(testProjectId, branchName, 'main', {
        message: 'Promote staging to main',
        author: { name: 'Test User', email: 'test@example.com' },
      });

      expect(mergeResult.hash).toBeTruthy();

      await gitService.switchBranch(testProjectId, 'main');
      const promotedFile = await gitService.readFile(testProjectId, 'content/pages/promote-test.md');
      expect(promotedFile).toContain('promote me');
    });
  });

  describe('File Operations', () => {
    it('should read a file', async () => {
      const content = await gitService.readFile(testProjectId, 'README.md');
      
      expect(content).toContain('# Test Repo');
    });

    it('should list files in directory', async () => {
      const files = await gitService.listFiles(testProjectId, 'content/pages');
      
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      
      const indexFile = files.find(f => f.name === 'index.md');
      expect(indexFile).toBeDefined();
      expect(indexFile?.type).toBe('file');
    });

    it('should write a file and commit', async () => {
      const filePath = 'content/pages/test.md';
      const fileContent = '---\ntitle: Test Page\n---\n\nTest content';
      
      await gitService.writeFile(testProjectId, filePath, fileContent, {
        message: 'Add test page',
        author: { name: 'Test User', email: 'test@example.com' },
      });
      
      // Verify file was written
      const readContent = await gitService.readFile(testProjectId, filePath);
      expect(readContent).toBe(fileContent);
      
      // Verify commit was made
      const history = await gitService.getHistory(testProjectId, 1);
      expect(history[0].message).toBe('Add test page');
    });

    it('should delete a file and commit', async () => {
      // First create a file to delete
      const filePath = 'content/pages/to-delete.md';
      await gitService.writeFile(testProjectId, filePath, 'Delete me', {
        message: 'Add file to delete',
        author: { name: 'Test User', email: 'test@example.com' },
      });
      
      // Delete the file
      await gitService.deleteFile(testProjectId, filePath, {
        message: 'Delete test file',
        author: { name: 'Test User', email: 'test@example.com' },
      });
      
      // Verify file no longer exists (readFile returns null for missing files)
      expect(await gitService.readFile(testProjectId, filePath)).toBeNull();
    });
  });

  describe('Path Validation', () => {
    it('should prevent directory traversal attacks', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      await expect(gitService.readFile(testProjectId, maliciousPath)).rejects.toThrow('Invalid path');
    });

    it('should handle paths with special characters safely', async () => {
      const filePath = 'content/pages/test-file_123.md';
      const content = 'Test content';
      
      await gitService.writeFile(testProjectId, filePath, content, {
        message: 'Add file with special chars',
        author: { name: 'Test User', email: 'test@example.com' },
      });
      
      const readContent = await gitService.readFile(testProjectId, filePath);
      expect(readContent).toBe(content);
    });
  });
});
