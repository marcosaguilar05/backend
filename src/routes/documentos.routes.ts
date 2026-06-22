import { Router } from 'express';
import { documentosController } from '../controllers/documentos.controller';
import { documentosDashboardController } from '../controllers/documentos-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Dashboard routes (antes de rutas con params)
router.get('/dashboard/kpis', documentosDashboardController.getKPIs);
router.get('/dashboard/calendar', documentosDashboardController.getCalendarEvents);
router.get('/dashboard/expiring-list', documentosDashboardController.getExpiringList);
router.get('/dashboard/by-area', documentosDashboardController.getByArea);

router.get('/', documentosController.getAll);
router.get('/export-zip', documentosController.exportZip);
router.get('/filters', documentosController.getFilterOptions);
router.get('/:id', documentosController.getById);
router.post('/', documentosController.create);
router.put('/:id', documentosController.update);
router.post('/batch-delete', documentosController.deleteBatch);
router.delete('/:id', documentosController.delete);

export default router;
