import { Router } from 'express';
import {
    getRubros, getTipos, getConceptos, getPresupuestoFilterOptions,
    getPresupuestos, getPresupuestoById, createPresupuesto, updatePresupuesto, deletePresupuesto,
    addPresupuestoItem, updatePresupuestoItem, deletePresupuestoItem,
} from '../controllers/presupuestos.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Catálogos y filtros (ANTES de /:id)
router.get('/rubros', getRubros);
router.get('/tipos', getTipos);
router.get('/conceptos', getConceptos);
router.get('/filters', getPresupuestoFilterOptions);

// Items (ANTES de /:id)
router.put('/items/:itemId', updatePresupuestoItem);
router.delete('/items/:itemId', deletePresupuestoItem);

// CRUD
router.get('/', getPresupuestos);
router.get('/:id', getPresupuestoById);
router.post('/', createPresupuesto);
router.put('/:id', updatePresupuesto);
router.delete('/:id', deletePresupuesto);

// Items de un presupuesto específico
router.post('/:presupuestoId/items', addPresupuestoItem);

export default router;
