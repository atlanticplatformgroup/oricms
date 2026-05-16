import type { Request, Response } from 'express';
import { notFound } from '../lib/responses';
import { handleAgentAccessError } from './middleware';
import { getRequestedBranch, loadCollectionReadContext } from './public-route-common';

export async function getAgentStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = await req.agentGateway!.getConfigStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent status error:');
  }
}

export async function getAgentBootstrap(req: Request, res: Response): Promise<void> {
  try {
    const bootstrap = await req.agentGateway!.getSessionBootstrap(
      typeof req.query.branch === 'string' ? req.query.branch : undefined,
    );
    res.json({ success: true, data: bootstrap });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent bootstrap error:');
  }
}

export async function listAgentSchemas(req: Request, res: Response): Promise<void> {
  try {
    const branch = getRequestedBranch(req.query.branch);
    const result = await req.agentGateway!.getContentTypes(branch);
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent schemas error:');
  }
}

export async function getAgentSchema(req: Request, res: Response): Promise<void> {
  try {
    const branch = getRequestedBranch(req.query.branch);
    const result = await req.agentGateway!.getContentType(req.params.id, branch);
    if (!result.data) {
      notFound(res, 'Content type not found', 'CONTENT_TYPE_NOT_FOUND');
      return;
    }
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent schema error:');
  }
}

export async function getAgentRepositoryStructure(req: Request, res: Response): Promise<void> {
  try {
    const branch = getRequestedBranch(req.query.branch);
    const result = await req.agentGateway!.getRepositoryStructure(branch);
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent structure error:');
  }
}

export async function getAgentHistory(req: Request, res: Response): Promise<void> {
  try {
    const branch = getRequestedBranch(req.query.branch);
    const result = await req.agentGateway!.getGitHistory(branch);
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent history error:');
  }
}

export async function listAgentCollectionEntries(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.params;
    const branch = getRequestedBranch(req.query.branch);
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string, 10) || 20, 50);

    const context = await loadCollectionReadContext(req, res, name, branch);
    if (!context) {
      return;
    }

    const result = await req.agentGateway!.getCollectionEntries(
      name,
      { page, limit: pageSize },
      context.contentType,
      branch,
    );
    res.json({
      success: true,
      data: result.data,
      meta: { ...result.metadata, pagination: { page, pageSize, total: result.data.length } },
    });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent entries error:');
  }
}

export async function getAgentCollectionEntry(req: Request, res: Response): Promise<void> {
  try {
    const { name, id } = req.params;
    const branch = getRequestedBranch(req.query.branch);

    const context = await loadCollectionReadContext(req, res, name, branch);
    if (!context) {
      return;
    }

    const result = await req.agentGateway!.getEntry(name, id, context.contentType, branch);
    if (!result.data) {
      notFound(res, 'Entry not found', 'ENTRY_NOT_FOUND');
      return;
    }
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    handleAgentAccessError(res, error, 'Agent entry error:');
  }
}

export async function getAgentRawFile(req: Request, res: Response): Promise<void> {
  try {
    const filePath = req.params[0];
    const branch = getRequestedBranch(req.query.branch);
    const result = await req.agentGateway!.getRawFile(filePath, branch);
    res.json({ success: true, data: result.data, meta: result.metadata });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) {
      notFound(res, 'File not found', 'FILE_NOT_FOUND');
      return;
    }
    handleAgentAccessError(res, error, 'Agent file error:');
  }
}
