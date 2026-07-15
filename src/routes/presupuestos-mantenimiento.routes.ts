import { Router } from 'express';
import { presupuestosMantenimientoController } from '../controllers/presupuestos-mantenimiento.controller';
import { presupuestosController } from '../controllers/presupuestos.controller'; // Reusing for catalog routes
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteger todas las rutas
router.use(authMiddleware);

// CRUD Presupuesto Unificado
router.get('/', presupuestosMantenimientoController.getAll);
router.get('/:id', presupuestosMantenimientoController.getById);
router.post('/', presupuestosMantenimientoController.create);
router.put('/:id', presupuestosMantenimientoController.update);
router.delete('/:id', presupuestosMantenimientoController.delete);

export default router;
