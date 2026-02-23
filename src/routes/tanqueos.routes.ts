import { Router } from 'express';
import { tanqueosController } from '../controllers/tanqueos.controller';
import { tanqueosDashboardController } from '../controllers/tanqueos-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', tanqueosController.getAll);
router.get('/filter-options', tanqueosController.getFilterOptions); // Nueva ruta

// Dashboard Analytics Routes
router.get('/dashboard/kpis', tanqueosDashboardController.getKPIs);
router.get('/dashboard/saldos-bombas', tanqueosDashboardController.getSaldosBombas);
router.get('/dashboard/consumption-over-time', tanqueosDashboardController.getConsumptionOverTime);
router.get('/dashboard/fuel-distribution', tanqueosDashboardController.getFuelDistribution);
router.get('/dashboard/by-area', tanqueosDashboardController.getByArea);
router.get('/dashboard/top-vehicles', tanqueosDashboardController.getTopVehicles);
router.get('/dashboard/vehicles-by-area', tanqueosDashboardController.getVehiclesByArea);
router.get('/dashboard/by-driver', tanqueosDashboardController.getByDriver);
router.get('/dashboard/by-pump', tanqueosDashboardController.getByPump);
router.get('/dashboard/alerts', tanqueosDashboardController.getAlerts);
router.get('/dashboard/alerts/:alertType/records', tanqueosDashboardController.getAlertRecords);
router.get('/dashboard/detailed-table', tanqueosDashboardController.getDetailedTable);

router.get('/reportes/financiero', tanqueosController.getFinancialReport);
router.get('/reportes/general', tanqueosController.getExportData);
router.get('/dashboard-link', tanqueosController.getDashboardLink);
router.get('/:id', tanqueosController.getById);
// Importar masivamente
router.post('/import', tanqueosController.importBatch);

// Crear nuevo tanqueo
router.post('/', tanqueosController.create);
router.put('/:id', tanqueosController.update);
router.delete('/:id', tanqueosController.delete);

export default router;