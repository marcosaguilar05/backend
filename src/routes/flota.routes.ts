import { Router } from 'express';
import { getVehiculos, getVehiculoDetalle, getFlotaCatalogos, syncVehiculos } from '../controllers/flota.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/catalogos', getFlotaCatalogos);
router.get('/vehiculos', getVehiculos);
router.get('/vehiculos/:id', getVehiculoDetalle);
router.post('/sync', syncVehiculos);

export default router;
