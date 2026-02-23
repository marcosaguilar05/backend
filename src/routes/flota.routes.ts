import { Router } from 'express';
import { getVehiculos, getVehiculoDetalle, getCatalogos, syncVehiculos } from '../controllers/flota.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/vehiculos', getVehiculos);
router.post('/sync', syncVehiculos);
router.get('/vehiculos/:id', getVehiculoDetalle);
router.get('/catalogos', getCatalogos);

export default router;
