"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tanqueos_controller_1 = require("../controllers/tanqueos.controller");
const tanqueos_dashboard_controller_1 = require("../controllers/tanqueos-dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authMiddleware);
router.get('/', tanqueos_controller_1.tanqueosController.getAll);
router.get('/filter-options', tanqueos_controller_1.tanqueosController.getFilterOptions); // Nueva ruta
// Dashboard Analytics Routes
router.get('/dashboard/kpis', tanqueos_dashboard_controller_1.tanqueosDashboardController.getKPIs);
router.get('/dashboard/saldos-bombas', tanqueos_dashboard_controller_1.tanqueosDashboardController.getSaldosBombas);
router.get('/dashboard/consumption-over-time', tanqueos_dashboard_controller_1.tanqueosDashboardController.getConsumptionOverTime);
router.get('/dashboard/fuel-distribution', tanqueos_dashboard_controller_1.tanqueosDashboardController.getFuelDistribution);
router.get('/dashboard/by-area', tanqueos_dashboard_controller_1.tanqueosDashboardController.getByArea);
router.get('/dashboard/top-vehicles', tanqueos_dashboard_controller_1.tanqueosDashboardController.getTopVehicles);
router.get('/dashboard/vehicles-by-area', tanqueos_dashboard_controller_1.tanqueosDashboardController.getVehiclesByArea);
router.get('/dashboard/by-driver', tanqueos_dashboard_controller_1.tanqueosDashboardController.getByDriver);
router.get('/dashboard/by-pump', tanqueos_dashboard_controller_1.tanqueosDashboardController.getByPump);
router.get('/dashboard/alerts', tanqueos_dashboard_controller_1.tanqueosDashboardController.getAlerts);
router.get('/dashboard/alerts/:alertType/records', tanqueos_dashboard_controller_1.tanqueosDashboardController.getAlertRecords);
router.get('/dashboard/detailed-table', tanqueos_dashboard_controller_1.tanqueosDashboardController.getDetailedTable);
router.get('/reportes/financiero', tanqueos_controller_1.tanqueosController.getFinancialReport);
router.get('/reportes/general', tanqueos_controller_1.tanqueosController.getExportData);
router.get('/dashboard-link', tanqueos_controller_1.tanqueosController.getDashboardLink);
router.get('/:id', tanqueos_controller_1.tanqueosController.getById);
// Importar masivamente
router.post('/import', tanqueos_controller_1.tanqueosController.importBatch);
// Crear nuevo tanqueo
router.post('/', tanqueos_controller_1.tanqueosController.create);
router.put('/:id', tanqueos_controller_1.tanqueosController.update);
router.delete('/:id', tanqueos_controller_1.tanqueosController.delete);
exports.default = router;
