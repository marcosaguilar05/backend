import { Router } from 'express';
import {
    getEngrases, getEngraseById, createEngrase, updateEngrase, deleteEngrase,
    getEngraseFilterOptions, getEngrasesDashboardKPIs, getEngrasesSpendingOverTime,
    getEngrasesServiceComparison, getEngrasesByPlaca, getEngrasePlacaMonthly,
    getEngrasesByArea, getEngrasesAlerts, getEngraseAlertRecords,
    getEngrasesDetailedTable, getEngrasesPlacaMonthMatrix, getEngrasesDashboardLink,
    getEngraseFinancialReport, getEngraseGeneralReport,
} from '../controllers/engrases.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Rutas específicas ANTES de /:id
router.get('/filter-options', getEngraseFilterOptions);
router.get('/dashboard-link', getEngrasesDashboardLink);
router.get('/reportes/financiero', getEngraseFinancialReport);
router.get('/reportes/general', getEngraseGeneralReport);
router.get('/dashboard/kpis', getEngrasesDashboardKPIs);
router.get('/dashboard/spending-time', getEngrasesSpendingOverTime);
router.get('/dashboard/service-comparison', getEngrasesServiceComparison);
router.get('/dashboard/by-placa', getEngrasesByPlaca);
router.get('/dashboard/placa-monthly/:placa', getEngrasePlacaMonthly);
router.get('/dashboard/by-area', getEngrasesByArea);
router.get('/dashboard/alerts', getEngrasesAlerts);
router.get('/dashboard/alert-records/:alertType', getEngraseAlertRecords);
router.get('/dashboard/detailed-table', getEngrasesDetailedTable);
router.get('/dashboard/placa-month-matrix', getEngrasesPlacaMonthMatrix);

// CRUD
router.get('/', getEngrases);
router.get('/:id', getEngraseById);
router.post('/', createEngrase);
router.put('/:id', updateEngrase);
router.delete('/:id', deleteEngrase);

export default router;
