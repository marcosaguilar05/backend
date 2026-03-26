import { Router } from 'express';
import { engrasesController } from '../controllers/engrases.controller';
import { engrasesDashboardController } from '../controllers/engrases-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Dashboard routes (before :id to avoid conflicts)
router.get('/dashboard/kpis', engrasesDashboardController.getKPIs);
router.get('/dashboard/spending-time', engrasesDashboardController.getSpendingOverTime);
router.get('/dashboard/service-comparison', engrasesDashboardController.getServiceComparison);
router.get('/dashboard/by-placa', engrasesDashboardController.getByPlaca);
router.get('/dashboard/placa-monthly/:placa', engrasesDashboardController.getPlacaMonthly);
router.get('/dashboard/by-area', engrasesDashboardController.getByArea);
router.get('/dashboard/alerts', engrasesDashboardController.getAlerts);
router.get('/dashboard/alert-records/:alertType', engrasesDashboardController.getAlertRecords);
router.get('/dashboard/detailed-table', engrasesDashboardController.getDetailedTable);
router.get('/dashboard/placa-month-matrix', engrasesDashboardController.getPlacaMonthMatrix);

router.get('/', engrasesController.getAll);
router.get('/filter-options', engrasesController.getFilterOptions);
router.get('/reportes/financiero', engrasesController.getFinancialReport);
router.get('/reportes/general', engrasesController.getExportData);
router.get('/dashboard-link', engrasesController.getDashboardLink);
router.get('/:id', engrasesController.getById);
router.post('/', engrasesController.create);
router.put('/:id', engrasesController.update);
router.post('/batch-delete', engrasesController.deleteBatch);
router.delete('/:id', engrasesController.delete);

export default router;

