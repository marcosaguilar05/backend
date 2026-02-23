import { Router } from 'express';
import { uploadController, upload } from '../controllers/upload.controller';

const router = Router();

// POST /api/upload - Subir un documento PDF
router.post('/', upload.single('file'), uploadController.uploadDocument);

// DELETE /api/upload - Eliminar un documento
router.delete('/', uploadController.deleteDocument);

export default router;
