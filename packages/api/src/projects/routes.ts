import { Router } from 'express';
import projectRoutes from './project-routes';
import deliveryKeyRoutes from './delivery-key-routes';
import memberRoutes from './member-routes';
import gitConfigRoutes from './git-config-routes';
import branchMappingRoutes from './branch-mapping-routes';
import workspaceRoutes from './workspace-routes';

const router = Router({ mergeParams: true });

router.use(projectRoutes);
router.use(deliveryKeyRoutes);
router.use(memberRoutes);
router.use(gitConfigRoutes);
router.use(branchMappingRoutes);
router.use(workspaceRoutes);

export default router;
