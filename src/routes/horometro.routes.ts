import { Router } from 'express';
import { getAgrupado, getDetalle, createHorometro, deleteHorometro } from '../controllers/horometro.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/agrupado', getAgrupado);
router.get('/detalle/:placa_id', getDetalle);
router.post('/', createHorometro);
router.delete('/:id', deleteHorometro);

export default router;
