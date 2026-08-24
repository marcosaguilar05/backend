import { Router } from 'express';
import { getAgrupado, getDetalle, createHorometro, updateHorometro, deleteHorometro } from '../controllers/horometro.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/agrupado', getAgrupado);
router.get('/detalle/:placa_id', getDetalle);
router.post('/', createHorometro);
router.put('/:id', updateHorometro);
router.patch('/:id', updateHorometro);
router.delete('/:id', deleteHorometro);

export default router;
