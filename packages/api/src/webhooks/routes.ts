import { Router } from 'express';
import githubRoutes from './github-routes';
import gitlabRoutes from './gitlab-routes';
import genericRoutes from './generic-routes';
export { queueBuildJob } from './build-queue';

const router = Router();

router.use(githubRoutes);
router.use(gitlabRoutes);
router.use(genericRoutes);

export default router;
