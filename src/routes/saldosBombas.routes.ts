import { Router } from 'express';
import { getSaldosBombas, getSaldosBombasFilterOptions } from '../controllers/saldosBombas.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/filters', getSaldosBombasFilterOptions);
router.get('/', getSaldosBombas);

export default router;
