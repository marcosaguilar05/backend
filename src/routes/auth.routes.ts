import { Router } from 'express';
import { login, logout, getProfile } from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/profile', getProfile);

export default router;