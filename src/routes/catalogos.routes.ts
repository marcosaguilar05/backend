import { Router } from 'express';
import { catalogosController } from '../controllers/catalogos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/bombas', catalogosController.getBombas);
router.get('/conductores', catalogosController.getConductores);
router.get('/placas', catalogosController.getPlacas);
router.get('/areas', catalogosController.getAreas);
router.get('/saldo-bomba', catalogosController.getSaldoBomba);

export default router;
