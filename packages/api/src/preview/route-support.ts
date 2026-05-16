import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { prisma } from '../lib/prisma';
import { GitService } from '../git/service';
import {
  applyLocaleToFrontmatterAndBody,
  applyLocaleToObjectContent,
} from './localization';

export async function resolvePreviewWorkspace(
  projectId: string,
  branch?: string,
  ref?: string,
): Promise<{
  gitService: GitService;
  workspacePath: string;
} | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      repoUrl: true,
      defaultBranch: true,
    },
  });

  if (!project) {
    return null;
  }

  const gitService = new GitService();
  if (project.repoUrl) {
    await gitService.cloneOrPull(projectId, project.repoUrl, branch || project.defaultBranch);
  }

  if (ref) {
    await gitService.checkoutRef(projectId, ref);
  }

  return {
    gitService,
    workspacePath: gitService.getWorkspaceDir(projectId),
  };
}

export function resolveWorkspaceContentPath(workspacePath: string, contentPath: string): string | null {
  const fullPath = path.resolve(workspacePath, contentPath);
  const normalizedWorkspace = path.normalize(workspacePath + path.sep);

  if (!path.normalize(fullPath + path.sep).startsWith(normalizedWorkspace)) {
    return null;
  }

  return fullPath;
}

export async function loadContentFile(filePath: string, locale?: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  const ext = path.extname(filePath);

  if (ext === '.md') {
    const parsed = parseMarkdown(content);
    const resolved = applyLocaleToFrontmatterAndBody(parsed.frontmatter, parsed.body, locale);
    return {
      frontmatter: resolved.frontmatter,
      body: resolved.body,
    };
  }

  const parsed = YAML.parse(content);
  return applyLocaleToObjectContent(parsed, locale);
}

export async function loadAllContent(workspacePath: string, locale?: string): Promise<Record<string, unknown>> {
  const content: Record<string, unknown> = {};
  const contentDir = path.join(workspacePath, 'content');

  try {
    const entries = await fs.readdir(contentDir, { recursive: true });

    for (const entry of entries) {
      const fullPath = path.join(contentDir, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isFile() && (entry.endsWith('.yaml') || entry.endsWith('.yml') || entry.endsWith('.md'))) {
        const relativePath = path.relative(contentDir, fullPath);
        content[relativePath] = await loadContentFile(fullPath, locale);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return content;
}

export async function listPreviewPages(
  workspacePath: string,
  locale?: string,
): Promise<Array<{ path: string; title: string | null; localeResolvedFrom: string | null }>> {
  const pagesDir = path.join(workspacePath, 'content', 'pages');
  const pages: Array<{ path: string; title: string | null; localeResolvedFrom: string | null }> = [];

  try {
    const entries = await fs.readdir(pagesDir);

    for (const entry of entries) {
      const fullPath = path.join(pagesDir, entry);
      const stat = await fs.stat(fullPath);

      if (!stat.isFile() || !entry.endsWith('.md')) {
        continue;
      }

      const parsed = await loadContentFile(fullPath, locale) as { frontmatter?: Record<string, unknown> } | null;
      const frontmatter = parsed?.frontmatter ?? {};
      pages.push({
        path: path.join('content', 'pages', entry),
        title: typeof frontmatter.title === 'string' ? frontmatter.title : null,
        localeResolvedFrom: typeof frontmatter._resolvedLocaleSource === 'string' ? frontmatter._resolvedLocaleSource : null,
      });
    }
  } catch {
    // Missing pages directory should return an empty list.
  }

  return pages;
}

export async function loadComponentSchema(
  workspacePath: string,
  schemaId: string,
): Promise<unknown | null> {
  const schemaPath = path.join(workspacePath, 'content', 'schemas', 'components', `${schemaId}.yaml`);

  try {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');
    return YAML.parse(schemaContent);
  } catch {
    return null;
  }
}

function parseMarkdown(content: string): { frontmatter: unknown; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    return {
      frontmatter: YAML.parse(match[1]),
      body: match[2].trim(),
    };
  }

  return {
    frontmatter: {},
    body: content,
  };
}
