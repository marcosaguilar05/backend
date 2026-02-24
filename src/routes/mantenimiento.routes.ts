import { Router } from 'express';
import { getEventos, createEvento, getPlanes, createPlan, updatePlan, getTiposMantenimiento, getTalleres, getTiposCondicion } from '../controllers/mantenimiento.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/eventos', getEventos);
router.post('/eventos', createEvento);

router.get('/planes', getPlanes);
router.post('/planes', createPlan);
router.put('/planes/:id', updatePlan);

router.get('/tipos', getTiposMantenimiento);
router.get('/condiciones', getTiposCondicion);
router.get('/talleres', getTalleres);

export default router;
