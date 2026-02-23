import { Router } from 'express';
import {
    getDocumentos, getDocumentoById, createDocumento, updateDocumento, deleteDocumento,
    getDocumentoFilterOptions, getDocumentosDashboardKPIs, getDocumentosCalendar,
    getDocumentosExpiringList, getDocumentosByArea,
} from '../controllers/documentos.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// Rutas específicas ANTES de /:id
router.get('/filters', getDocumentoFilterOptions);
router.get('/dashboard/kpis', getDocumentosDashboardKPIs);
router.get('/dashboard/calendar', getDocumentosCalendar);
router.get('/dashboard/expiring-list', getDocumentosExpiringList);
router.get('/dashboard/by-area', getDocumentosByArea);

// CRUD
router.get('/', getDocumentos);
router.get('/:id', getDocumentoById);
router.post('/', createDocumento);
router.put('/:id', updateDocumento);
router.delete('/:id', deleteDocumento);

export default router;
