import { Router } from 'express';
import { pagosController } from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteger todas las rutas de pagos con el middleware de Supabase
router.use(authMiddleware);

router.get('/', pagosController.getAll);

export default router;
