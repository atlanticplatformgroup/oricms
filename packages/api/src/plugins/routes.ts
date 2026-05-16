import { Router } from 'express';
import catalogRoutes from './catalog-routes';
import configRoutes from './config-routes';
import eventsRoutes from './events-routes';

const router = Router({ mergeParams: true });

router.use(catalogRoutes);
router.use(configRoutes);
router.use(eventsRoutes);

export default router;
