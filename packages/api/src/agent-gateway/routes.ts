import { Router } from 'express';
import adminRoutes from './admin-routes';
import publicRoutes from './public-routes';
import writeRoutes from './write-routes';

const router = Router();

router.use(publicRoutes);
router.use(adminRoutes);
router.use(writeRoutes);

export default router;
