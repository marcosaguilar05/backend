import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { refreshTokenController } from '../controllers/refreshToken.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/user', authMiddleware, authController.getUser);
router.post('/refresh', refreshTokenController.refresh);

export default router;