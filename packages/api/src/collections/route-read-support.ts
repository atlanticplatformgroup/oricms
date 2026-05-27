import type { Request, Response } from 'express';
import type { CollectionQuery } from '@ori/shared';
import { badRequest, notFound } from '../lib/responses';
import {
  createResourceCollectionLink,
  getContentResourceCollectionId,
} from '../resources/service';
import { getCollectionServiceForProject } from './route-bootstrap';

export function parseCollectionQueryOrRespond(req: Request, res: Response): CollectionQuery | null {
  const queryParams: CollectionQuery = {
    page: req.query.page as number | undefined,
    limit: req.query.limit as number | undefined,
    populate: req.query.populate as string | undefined,
    search: req.query.search as string | undefined,
  };

  if (req.query.filter) {
    try {
      queryParams.filter = JSON.parse(req.query.filter as string);
    } catch {
      badRequest(res, 'Filter must be valid JSON', 'INVALID_FILTER');
      return null;
    }
  }

  if (req.query.sort) {
    try {
      queryParams.sort = JSON.parse(req.query.sort as string);
    } catch {
      badRequest(res, 'Sort must be valid JSON', 'INVALID_SORT');
      return null;
    }
  }

  return queryParams;
}

export async function getCollectionEntriesOrRespond(
  req: Request,
  res: Response,
  projectId: string,
  collectionId: string,
) {
  const initialized = await getCollectionServiceForProject(projectId, res);
  if (!initialized) {
    return null;
  }

  const queryParams = parseCollectionQueryOrRespond(req, res);
  if (!queryParams) {
    return null;
  }

  return initialized.service.findMany(collectionId, queryParams);
}

export async function listCollectionsOrRespond(
  projectId: string,
  res: Response,
  pagination?: { page: number; limit: number },
) {
  const initialized = await getCollectionServiceForProject(projectId, res);
  if (!initialized) {
    return null;
  }

  const allCollections = (await initialized.service.listCollections()).map((collection) => ({
    ...collection,
    resource: createResourceCollectionLink(
      getContentResourceCollectionId(collection.id),
      'content',
      'user',
    ),
  }));

  if (!pagination) {
    return { collections: allCollections };
  }

  const { page, limit } = pagination;
  const total = allCollections.length;
  const pageCount = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const end = start + limit;
  const collections = allCollections.slice(start, end);

  return { collections, page, limit, total, pageCount };
}

export async function getCollectionEntryOrRespond(
  projectId: string,
  collectionId: string,
  id: string,
  populate: string | undefined,
  res: Response,
) {
  const initialized = await getCollectionServiceForProject(projectId, res);
  if (!initialized) {
    return null;
  }

  const result = await initialized.service.findOneWithRevision(collectionId, id, populate);
  if (!result) {
    notFound(res, 'Entry not found');
    return null;
  }

  return { entry: result.entry, meta: { revision: result.revision } };
}

export async function getEntryHistoryOrRespond(
  projectId: string,
  collectionId: string,
  id: string,
  limit: number,
  branch: string | undefined,
  res: Response,
) {
  const initialized = await getCollectionServiceForProject(projectId, res, branch);
  if (!initialized) {
    return null;
  }

  const history = await initialized.service.getHistory(collectionId, id, limit);
  return { history };
}

export async function getEntryVersionOrRespond(
  projectId: string,
  collectionId: string,
  id: string,
  hash: string,
  branch: string | undefined,
  res: Response,
) {
  const initialized = await getCollectionServiceForProject(projectId, res, branch);
  if (!initialized) {
    return null;
  }

  const entry = await initialized.service.getFileAtCommit(collectionId, id, hash);
  if (!entry) {
    notFound(res, 'Version not found');
    return null;
  }

  return { entry };
}
