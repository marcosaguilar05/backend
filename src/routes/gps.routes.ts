import { Router } from 'express';
import { gpsController } from '../controllers/gps.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteger todas las rutas de GPS con el middleware de Supabase
router.use(authMiddleware);

router.get('/tracking', gpsController.getTracking);
router.get('/history/:deviceId', gpsController.getHistory);

export default router;
