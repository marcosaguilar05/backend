"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const catalogos_controller_1 = require("../controllers/catalogos.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Todas las rutas requieren autenticación
router.use(auth_middleware_1.authMiddleware);
router.get('/bombas', catalogos_controller_1.catalogosController.getBombas);
router.get('/conductores', catalogos_controller_1.catalogosController.getConductores);
router.get('/placas', catalogos_controller_1.catalogosController.getPlacas);
router.get('/areas', catalogos_controller_1.catalogosController.getAreas);
router.get('/saldo-bomba', catalogos_controller_1.catalogosController.getSaldoBomba);
exports.default = router;
