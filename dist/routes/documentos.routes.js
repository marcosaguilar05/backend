"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const documentos_controller_1 = require("../controllers/documentos.controller");
const documentos_dashboard_controller_1 = require("../controllers/documentos-dashboard.controller");
const router = (0, express_1.Router)();
// Dashboard routes (antes de rutas con params)
router.get('/dashboard/kpis', documentos_dashboard_controller_1.documentosDashboardController.getKPIs);
router.get('/dashboard/calendar', documentos_dashboard_controller_1.documentosDashboardController.getCalendarEvents);
router.get('/dashboard/expiring-list', documentos_dashboard_controller_1.documentosDashboardController.getExpiringList);
router.get('/dashboard/by-area', documentos_dashboard_controller_1.documentosDashboardController.getByArea);
router.get('/', documentos_controller_1.documentosController.getAll);
router.get('/filters', documentos_controller_1.documentosController.getFilterOptions);
router.get('/:id', documentos_controller_1.documentosController.getById);
router.post('/', documentos_controller_1.documentosController.create);
router.put('/:id', documentos_controller_1.documentosController.update);
router.delete('/:id', documentos_controller_1.documentosController.delete);
exports.default = router;
