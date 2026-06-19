"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_controller_1 = require("../controllers/upload.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// POST /api/upload - Subir un documento PDF
router.post('/', upload_controller_1.upload.single('file'), upload_controller_1.uploadController.uploadDocument);
// DELETE /api/upload - Eliminar un documento
router.delete('/', upload_controller_1.uploadController.deleteDocument);
exports.default = router;
