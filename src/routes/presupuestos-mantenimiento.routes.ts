import { Router } from 'express';
import { presupuestosMantenimientoController } from '../controllers/presupuestos-mantenimiento.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Catálogos y Filtros
router.get('/filters', presupuestosMantenimientoController.getFilterOptions);
router.get('/rubros', presupuestosMantenimientoController.getRubros);
router.get('/tipos', presupuestosMantenimientoController.getTipos);
router.get('/conceptos', presupuestosMantenimientoController.getConceptos);
// Dashboard
router.get('/dashboard/kpis', presupuestosMantenimientoController.getDashboardKPIs);
router.get('/dashboard/matrix', presupuestosMantenimientoController.getDashboardMatrix);
router.get('/dashboard/by-placa', presupuestosMantenimientoController.getDashboardByPlaca);
router.get('/dashboard/by-empresa', presupuestosMantenimientoController.getDashboardByEmpresa);

// CRUD Presupuesto Unificado
router.get('/', presupuestosMantenimientoController.getAll);
router.get('/:id', presupuestosMantenimientoController.getById);
router.post('/', presupuestosMantenimientoController.create);
router.put('/:id', presupuestosMantenimientoController.update);
router.delete('/:id', presupuestosMantenimientoController.delete);

export default router;
