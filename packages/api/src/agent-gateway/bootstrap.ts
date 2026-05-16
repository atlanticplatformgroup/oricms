import crypto from 'crypto';
import type { AgentWritePolicy, ProjectRole } from '@ori/shared';

export function buildBootstrapSummaryMarkdown(params: {
  allowedBranches: string[];
  branch: string;
  contentCollections: Array<{ id: string; contentType: string }>;
  projectName: string;
  projectRole: ProjectRole;
  readableCollections: string[];
  writableCollections: string[];
  writePolicies: AgentWritePolicy[];
}): string {
  const {
    allowedBranches,
    branch,
    contentCollections,
    projectName,
    projectRole,
    readableCollections,
    writableCollections,
    writePolicies,
  } = params;

  const lines: string[] = [
    '# OriCMS agent brief',
    '',
    `Project: ${projectName}`,
    `Branch: ${branch}`,
    `Role: ${projectRole}`,
    '',
    'Capabilities:',
    `- Allowed branches: ${allowedBranches.join(', ') || 'none'}`,
    `- Read collections: ${readableCollections.join(', ') || 'none'}`,
    `- Write collections: ${writableCollections.join(', ') || 'none'}`,
  ];

  if (contentCollections.length > 0) {
    lines.push('', 'Content model:');
    for (const collection of contentCollections) {
      lines.push(`- ${collection.id} -> ${collection.contentType}`);
    }
  }

  if (writePolicies.length > 0) {
    lines.push('', 'Write policies:');
    for (const policy of writePolicies) {
      const actions = [
        policy.canCreate ? 'create' : null,
        policy.canUpdate ? 'update' : null,
        policy.canDelete ? 'delete' : null,
      ].filter(Boolean).join(', ');
      lines.push(`- ${policy.collectionName}: ${policy.mode === 'AUTO_PUBLISH' ? 'auto-publish' : 'review'} on ${policy.targetBranch} (${actions || 'no write actions'})`);
    }
  }

  lines.push(
    '',
    'Entry identity:',
    '- Use returned `entryId` / `$id` as the canonical entry identifier.',
    '- Do not assume `slug` is the entry id.',
    '',
    'Workflow rules:',
    '- New entries default to `draft`.',
    '- `Ready` in the UI maps to `$status: published`.',
    '- Ask before destructive changes.',
    '- Do not publish unless explicitly asked.',
    '- If a mutation returns `RESOURCE_LOCKED`, wait or ask the user before retrying.',
    '- If a mutation returns `STALE_REVISION`, refetch the entry before trying again.',
    '- Respect allowed branches and collection write policies.',
  );

  return lines.join('\n');
}

export function buildConfigFreshness(params: {
  allowedBranches: string[];
  allowedCollections: string[];
  branch: string;
  configUpdatedAt?: string;
  projectId: string;
  projectRole: ProjectRole;
  writeConfigs: Array<{
    collectionName: string;
    mode: string;
    targetBranch: string;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    updatedAt: string;
  }>;
}): { generatedAt: string; configVersion: string; configUpdatedAt?: string } {
  const generatedAt = new Date().toISOString();
  const latestWriteConfigUpdatedAt = params.writeConfigs
    .map((policy) => policy.updatedAt)
    .sort()
    .at(-1);
  const configUpdatedAt = [params.configUpdatedAt, latestWriteConfigUpdatedAt].filter(Boolean).sort().at(-1);
  const configVersion = crypto.createHash('sha256').update(JSON.stringify({
    projectId: params.projectId,
    role: params.projectRole,
    branch: params.branch,
    allowedBranches: params.allowedBranches,
    allowedCollections: params.allowedCollections,
    accessUpdatedAt: params.configUpdatedAt,
    writeConfigs: params.writeConfigs,
  })).digest('hex');

  return {
    generatedAt,
    configVersion,
    ...(configUpdatedAt ? { configUpdatedAt } : {}),
  };
}
