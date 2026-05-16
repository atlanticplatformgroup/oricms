import { Router } from 'express';
import { GitService } from './service';
import { createRepositoryRoutes } from './repository-routes';
import { createBranchRoutes } from './branch-routes';
import { createPromotionRoutes } from './promotion-routes';
import { createSchemaRoutes } from './schema-routes';
import { createHistoryRoutes } from './history-routes';

const router = Router({ mergeParams: true });
const gitService = new GitService();

router.use(createRepositoryRoutes(gitService));
router.use('/branches', createBranchRoutes(gitService));
router.use(createPromotionRoutes(gitService));
router.use('/schemas', createSchemaRoutes(gitService));
router.use('/history', createHistoryRoutes(gitService));

export default router;
