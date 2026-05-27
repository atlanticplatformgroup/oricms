/**
 * Collections Routes - REST API for collection entries
 * 
 * Endpoints:
 * GET    /api/v1/projects/:projectId/collections/:type
 * GET    /api/v1/projects/:projectId/collections/:type/:id
 * POST   /api/v1/projects/:projectId/collections/:type
 * PUT    /api/v1/projects/:projectId/collections/:type/:id
 * DELETE /api/v1/projects/:projectId/collections/:type/:id
 */

import { Router } from 'express';
import { registerCollectionConfigRoutes } from './config-routes';
import { registerCollectionEntryReadRoutes } from './entry-read-routes';
import { registerCollectionEntryTransferRoutes } from './entry-transfer-routes';
import { registerCollectionEntryMutationRoutes } from './entry-mutation-routes';

const router = Router({ mergeParams: true });

registerCollectionConfigRoutes(router);
registerCollectionEntryReadRoutes(router);
registerCollectionEntryTransferRoutes(router);
registerCollectionEntryMutationRoutes(router);

export default router;
