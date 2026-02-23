"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const saldosBombas_controller_1 = require("../controllers/saldosBombas.controller");
const router = (0, express_1.Router)();
router.get('/', saldosBombas_controller_1.saldosBombasController.getAll);
router.get('/filters', saldosBombas_controller_1.saldosBombasController.getFilterOptions);
exports.default = router;
