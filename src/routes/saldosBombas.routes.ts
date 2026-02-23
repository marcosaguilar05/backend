import { Router } from 'express';
import { saldosBombasController } from '../controllers/saldosBombas.controller';

const router = Router();

router.get('/', saldosBombasController.getAll);
router.get('/filters', saldosBombasController.getFilterOptions);

export default router;
