import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  branchMatchesPattern,
  buildSignedRevalidationHeaders,
  deriveRevalidationPaths,
  evaluateWebhookUrlPolicy,
  extractProjectEnvironments,
  logWebhookDispatchFailure,
  postJsonWithRetry,
  resolveRevalidationAuthMode,
  resolveWebhookRetryPolicy,
  writeWebhookTelemetry,
  type ProjectEnvironment,
} from './shared';

export async function triggerMappedEnvironmentActions(
  projectId: string,
  branch: string,
  commit: string,
  commitMessage: string,
  changedFiles: string[],
): Promise<{
  triggered: boolean;
  reason?: string;
  environmentId?: string;
  environmentName?: string;
  deploy?: { triggered: boolean; reason?: string };
  revalidation?: { triggered: boolean; reason?: string; paths: string[] };
}> {
  const mappings = await prisma.branchEnvironmentMapping.findMany({
    where: { projectId },
    orderBy: { branchPattern: 'asc' },
  });
  const mapping = mappings.find((candidate) => branchMatchesPattern(branch, candidate.branchPattern));

  if (!mapping) return { triggered: false, reason: 'No branch mapping' };

  const isMergeCommit = /merge\s+(pull request|branch)/i.test(commitMessage || '');
  const shouldDeploy = mapping.autoDeploy || (mapping.deployOnMerge && isMergeCommit);
  if (!shouldDeploy) return { triggered: false, reason: 'Mapping disabled for this event' };
  if (!mapping.environmentId) return { triggered: false, reason: 'Mapped environment missing' };

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { settings: true } });
  let environments: ProjectEnvironment[] = [];
  try {
    environments = extractProjectEnvironments(project?.settings as Prisma.JsonValue);
  } catch (error) {
    return { triggered: false, reason: error instanceof Error ? error.message : 'Invalid environment secret configuration' };
  }

  const environment = environments.find((env) => env.id === mapping.environmentId);
  if (!environment) return { triggered: false, reason: 'Environment not found in project settings' };

  const result = {
    triggered: false,
    environmentId: environment.id,
    environmentName: environment.name,
    deploy: { triggered: false, reason: 'Environment has no build webhook' },
    revalidation: {
      triggered: false,
      reason: 'Environment has no revalidation URL',
      paths: deriveRevalidationPaths(changedFiles),
    },
  } as {
    triggered: boolean;
    reason?: string;
    environmentId?: string;
    environmentName?: string;
    deploy: { triggered: boolean; reason?: string };
    revalidation: { triggered: boolean; reason?: string; paths: string[] };
  };

  if (environment.buildWebhook) {
    const buildPolicy = await evaluateWebhookUrlPolicy(environment.buildWebhook, 'build');
    if (!buildPolicy.allowed) {
      result.deploy = { triggered: false, reason: buildPolicy.reason || 'Build webhook blocked by endpoint policy' };
      await writeWebhookTelemetry(projectId, 'environment.deploy', branch, environment.id, { outcome: 'failure', attempts: 0, reason: result.deploy.reason, errorType: 'policy' });
      logWebhookDispatchFailure('environment.deploy', projectId, branch, environment.id, environment.buildWebhook, { attempts: 0, error: result.deploy.reason, durationMs: 0, lastErrorType: 'policy' }, resolveWebhookRetryPolicy('build'));
    } else {
      const buildRetryPolicy = resolveWebhookRetryPolicy('build');
      const deployResponse = await postJsonWithRetry(
        environment.buildWebhook,
        { projectId, branch, commit, trigger: 'branch-mapping', environmentId: environment.id, environmentName: environment.name },
        { 'Content-Type': 'application/json' },
        { ...buildRetryPolicy, label: 'build webhook' },
      );

      if (deployResponse.ok) {
        result.deploy = { triggered: true };
        result.triggered = true;
        await writeWebhookTelemetry(projectId, 'environment.deploy', branch, environment.id, { outcome: 'success', attempts: deployResponse.attempts, status: deployResponse.status, durationMs: deployResponse.durationMs, retryPolicy: buildRetryPolicy });
      } else {
        result.deploy = { triggered: false, reason: deployResponse.error || 'Failed to call environment build webhook' };
        await writeWebhookTelemetry(projectId, 'environment.deploy', branch, environment.id, { outcome: 'failure', attempts: deployResponse.attempts, status: deployResponse.status, reason: deployResponse.error, errorType: deployResponse.lastErrorType || 'unknown', durationMs: deployResponse.durationMs, retryPolicy: buildRetryPolicy });
        logWebhookDispatchFailure('environment.deploy', projectId, branch, environment.id, environment.buildWebhook, deployResponse, buildRetryPolicy);
      }
    }
  }

  if (environment.revalidationUrl) {
    const revalidationPolicy = await evaluateWebhookUrlPolicy(environment.revalidationUrl, 'revalidation');
    if (!revalidationPolicy.allowed) {
      result.revalidation = { triggered: false, reason: revalidationPolicy.reason || 'Revalidation webhook blocked by endpoint policy', paths: result.revalidation.paths };
      await writeWebhookTelemetry(projectId, 'environment.revalidate', branch, environment.id, { outcome: 'failure', attempts: 0, reason: result.revalidation.reason, pathCount: result.revalidation.paths.length, errorType: 'policy' });
      logWebhookDispatchFailure('environment.revalidate', projectId, branch, environment.id, environment.revalidationUrl, { attempts: 0, error: result.revalidation.reason, durationMs: 0, lastErrorType: 'policy' }, resolveWebhookRetryPolicy('revalidation'));
    } else {
      const revalidationRetryPolicy = resolveWebhookRetryPolicy('revalidation');
      const revalidationPayload = {
        projectId,
        branch,
        commit,
        trigger: 'branch-mapping',
        environmentId: environment.id,
        environmentName: environment.name,
        changedFiles: changedFiles.slice(0, 500),
        paths: result.revalidation.paths,
      };
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (environment.revalidationSecret) {
        const authMode = resolveRevalidationAuthMode();
        if (authMode === 'legacy-secret-header' || authMode === 'signed-with-legacy') {
          headers['x-oricms-revalidation-secret'] = environment.revalidationSecret;
        }
        if (authMode === 'signed' || authMode === 'signed-with-legacy') {
          Object.assign(headers, buildSignedRevalidationHeaders(environment.revalidationSecret, revalidationPayload));
        }
      }
      const revalidationResponse = await postJsonWithRetry(environment.revalidationUrl, revalidationPayload, headers, { ...revalidationRetryPolicy, label: 'revalidation webhook' });

      if (revalidationResponse.ok) {
        result.revalidation = { triggered: true, paths: result.revalidation.paths };
        result.triggered = true;
        await writeWebhookTelemetry(projectId, 'environment.revalidate', branch, environment.id, { outcome: 'success', attempts: revalidationResponse.attempts, status: revalidationResponse.status, pathCount: result.revalidation.paths.length, durationMs: revalidationResponse.durationMs, retryPolicy: revalidationRetryPolicy });
      } else {
        result.revalidation = { triggered: false, reason: revalidationResponse.error || 'Failed to call revalidation webhook', paths: result.revalidation.paths };
        await writeWebhookTelemetry(projectId, 'environment.revalidate', branch, environment.id, { outcome: 'failure', attempts: revalidationResponse.attempts, status: revalidationResponse.status, reason: revalidationResponse.error, pathCount: result.revalidation.paths.length, errorType: revalidationResponse.lastErrorType || 'unknown', durationMs: revalidationResponse.durationMs, retryPolicy: revalidationRetryPolicy });
        logWebhookDispatchFailure('environment.revalidate', projectId, branch, environment.id, environment.revalidationUrl, revalidationResponse, revalidationRetryPolicy);
      }
    }
  }

  if (!result.triggered && !result.reason) {
    result.reason = 'No deployment/revalidation endpoint configured';
  }
  return result;
}
