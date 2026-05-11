import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { auditorMiddleware } from '../middleware/auditor.middleware';

const router = Router();

// Proteger todas las rutas con autenticación y permisos de auditor
router.use(authMiddleware);
router.use(auditorMiddleware);

// Rutas para areas_bombas
router.get('/bombas', adminController.getBombas);
router.post('/bombas', adminController.createBomba);
router.put('/bombas/:id', adminController.updateBomba);
router.delete('/bombas/:id', adminController.deleteBomba);

// Rutas para areas_conductores
router.get('/conductores', adminController.getConductores);
router.post('/conductores', adminController.createConductor);
router.put('/conductores/:id', adminController.updateConductor);
router.delete('/conductores/:id', adminController.deleteConductor);

// Rutas para areas_operacion
router.get('/operacion', adminController.getAreas);
router.post('/operacion', adminController.createArea);
router.put('/operacion/:id', adminController.updateArea);
router.delete('/operacion/:id', adminController.deleteArea);

// Rutas para areas_placas
router.get('/placas', adminController.getPlacas);
router.post('/placas', adminController.createPlaca);
router.put('/placas/:id', adminController.updatePlaca);
router.delete('/placas/:id', adminController.deletePlaca);

export default router;
