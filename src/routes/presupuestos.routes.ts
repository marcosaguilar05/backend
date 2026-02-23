import { Router } from 'express';
import { presupuestosController } from '../controllers/presupuestos.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Proteger todas las rutas
router.use(authMiddleware);

// Catálogos
router.get('/rubros', presupuestosController.getRubros);
router.get('/tipos', presupuestosController.getTipos);
router.post('/tipos', presupuestosController.createTipo);
router.get('/conceptos', presupuestosController.getConceptos);
router.post('/conceptos', presupuestosController.createConcepto);
router.get('/filters', presupuestosController.getFilterOptions);

// CRUD Presupuestos
router.get('/', presupuestosController.getAll);
router.get('/:id', presupuestosController.getById);
router.post('/', presupuestosController.create);
router.put('/:id', presupuestosController.update);
router.delete('/:id', presupuestosController.delete);

// Items
router.post('/:id/items', presupuestosController.addItem);
router.put('/items/:itemId', presupuestosController.updateItem);
router.delete('/items/:itemId', presupuestosController.deleteItem);

export default router;
