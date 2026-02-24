"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const presupuestos_controller_1 = require("../controllers/presupuestos.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Proteger todas las rutas
router.use(auth_middleware_1.authMiddleware);
// Catálogos
router.get('/rubros', presupuestos_controller_1.presupuestosController.getRubros);
router.get('/tipos', presupuestos_controller_1.presupuestosController.getTipos);
router.post('/tipos', presupuestos_controller_1.presupuestosController.createTipo);
router.get('/conceptos', presupuestos_controller_1.presupuestosController.getConceptos);
router.post('/conceptos', presupuestos_controller_1.presupuestosController.createConcepto);
router.get('/filters', presupuestos_controller_1.presupuestosController.getFilterOptions);
// CRUD Presupuestos
router.get('/', presupuestos_controller_1.presupuestosController.getAll);
router.get('/:id', presupuestos_controller_1.presupuestosController.getById);
router.post('/', presupuestos_controller_1.presupuestosController.create);
router.put('/:id', presupuestos_controller_1.presupuestosController.update);
router.delete('/:id', presupuestos_controller_1.presupuestosController.delete);
// Items
router.post('/:id/items', presupuestos_controller_1.presupuestosController.addItem);
router.put('/items/:itemId', presupuestos_controller_1.presupuestosController.updateItem);
router.delete('/items/:itemId', presupuestos_controller_1.presupuestosController.deleteItem);
exports.default = router;
