import type { Request, Response } from 'express';
import { notFound } from '../lib/responses';

export function getRequestedBranch(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : 'main';
}

export async function loadCollectionReadContext(req: Request, res: Response, collectionName: string, branch: string) {
  const collectionResult = await req.agentGateway!.getCollectionConfig(collectionName, branch);
  if (!collectionResult.data) {
    notFound(res, 'Collection not found', 'COLLECTION_NOT_FOUND');
    return null;
  }

  const contentTypeResult = await req.agentGateway!.getContentType(collectionResult.data.contentType, branch);
  if (!contentTypeResult.data) {
    notFound(res, 'Content type not found', 'CONTENT_TYPE_NOT_FOUND');
    return null;
  }

  return {
    collection: collectionResult.data,
    contentType: contentTypeResult.data,
  };
}
