import express from 'express';
import behaviorRoutes from './behavior.routes';
import profileRoutes from './profile.routes';
import crudRoutes from './crud.routes';
import extrasRoutes from './extras.routes';

const router = express.Router();
router.use(behaviorRoutes);
router.use(profileRoutes);
router.use(crudRoutes);
router.use(extrasRoutes);

export default router;
