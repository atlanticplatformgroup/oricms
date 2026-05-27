import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { forbidden } from '../lib/responses';
import { handleAgentAccessError } from './middleware';

type DiagnosticContext = {
  schemas: Array<{ name: string; fields?: Array<{ key?: string; type?: string }> }>;
  contentIssues: Array<Record<string, unknown>>;
};

async function collectSchemaDiagnosis(req: Request, branch: string, diagnosticContext: DiagnosticContext): Promise<void> {
  try {
    const schemasResult = await req.agentGateway!.getContentTypes(branch);
    diagnosticContext.schemas = schemasResult.data;
    for (const schema of schemasResult.data) {
      if (!schema.fields || schema.fields.length === 0) {
        diagnosticContext.contentIssues.push({
          type: 'schema_error',
          severity: 'warning',
          message: `Schema "${schema.name}" has no fields defined`,
          path: `schemas/${schema.name}.yaml`,
        });
      }
      const fieldKeys = schema.fields?.map((field) => field.key) || [];
      const duplicates = fieldKeys.filter((key, index) => key && fieldKeys.indexOf(key) !== index);
      if (duplicates.length > 0) {
        diagnosticContext.contentIssues.push({
          type: 'schema_error',
          severity: 'error',
          message: `Schema "${schema.name}" has duplicate field keys: ${duplicates.join(', ')}`,
          path: `schemas/${schema.name}.yaml`,
        });
      }
      for (const field of schema.fields || []) {
        if (!field.key) {
          diagnosticContext.contentIssues.push({
            type: 'schema_error',
            severity: 'error',
            message: `Schema "${schema.name}" has a field missing the "key" property`,
            path: `schemas/${schema.name}.yaml`,
          });
        }
        if (!field.type) {
          diagnosticContext.contentIssues.push({
            type: 'schema_error',
            severity: 'error',
            message: `Field "${field.key}" in schema "${schema.name}" is missing the "type" property`,
            path: `schemas/${schema.name}.yaml`,
          });
        }
      }
    }
  } catch (error) {
    diagnosticContext.contentIssues.push({
      type: 'schema_error',
      severity: 'error',
      message: 'Failed to load schemas for diagnosis',
      details: String(error),
    });
  }
}

async function collectFullDiagnosis(req: Request, branch: string, diagnosticContext: DiagnosticContext): Promise<void> {
  try {
    const historyResult = await req.agentGateway!.getGitHistory(branch);
    for (const commit of historyResult.data.slice(0, 5)) {
      const lowerMessage = commit.message.toLowerCase();
      if (lowerMessage.includes('fix') || lowerMessage.includes('broken') || lowerMessage.includes('error')) {
        diagnosticContext.contentIssues.push({
          type: 'build_correlation',
          severity: 'info',
          message: `Recent commit may be related to an issue: "${commit.message}"`,
          author: commit.author,
          date: commit.date,
        });
      }
    }
  } catch {
    // optional
  }
}

export async function diagnoseAgentProject(req: Request, res: Response): Promise<void> {
  try {
    const { scope = 'schema', branch = 'main' } = req.body as {
      scope?: 'schema' | 'content' | 'full';
      branch?: string;
    };
    if (!req.agentAccessConfig!.allowedBranches.includes(branch)) {
      forbidden(res, `Branch "${branch}" is not in allowed branches`, 'BRANCH_NOT_ALLOWED');
      return;
    }

    const projectId = req.agentAccessConfig!.projectId;
    const diagnosticContext: DiagnosticContext = {
      schemas: [],
      contentIssues: [],
    };

    if (scope === 'schema' || scope === 'full') {
      await collectSchemaDiagnosis(req, branch, diagnosticContext);
    }

    if (scope === 'full') {
      await collectFullDiagnosis(req, branch, diagnosticContext);
    }

    const diagnosisId = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await prisma.agentAuditLog.create({
      data: {
        projectId,
        agentSessionId: req.agentSessionId!,
        projectRole: req.projectRole,
        filePath: '',
        branch,
        contentRead: false,
        wasRedacted: false,
        piiPatternsFound: [],
        queryType: 'diagnosis',
        diagnosisId,
      },
    });

    res.json({
      success: true,
      data: {
        diagnosisId,
        scope,
        branch,
        timestamp: new Date().toISOString(),
        role: req.projectRole,
        summary: {
          totalIssues: diagnosticContext.contentIssues.length,
          errors: diagnosticContext.contentIssues.filter((issue) => issue.severity === 'error').length,
          warnings: diagnosticContext.contentIssues.filter((issue) => issue.severity === 'warning').length,
          info: diagnosticContext.contentIssues.filter((issue) => issue.severity === 'info').length,
        },
        issues: diagnosticContext.contentIssues,
        schemasAnalyzed: diagnosticContext.schemas.length,
        analysisContext: {
          schemaCount: diagnosticContext.schemas.length,
          schemaNames: diagnosticContext.schemas.map((schema) => schema.name),
        },
      },
    });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent diagnosis error:');
  }
}
