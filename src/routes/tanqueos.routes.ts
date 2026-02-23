import { Router } from 'express';
import {
    getTanqueos,
    getTanqueoById,
    createTanqueo,
    updateTanqueo,
    deleteTanqueo,
    getConductores,
    getPlacas,
    getBombas,
    getAreasOperacion,
    getFilterOptions,
} from '../controllers/tanqueos.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas específicas ANTES de /:id
router.get('/filter-options', getFilterOptions);
router.get('/catalogos/conductores', getConductores);
router.get('/catalogos/placas', getPlacas);
router.get('/catalogos/bombas', getBombas);
router.get('/catalogos/areas', getAreasOperacion);

// Rutas de tanqueos
router.get('/', getTanqueos);
router.get('/:id', getTanqueoById);
router.post('/', createTanqueo);
router.put('/:id', updateTanqueo);
router.delete('/:id', deleteTanqueo);

export default router;