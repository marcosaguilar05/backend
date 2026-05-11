import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

export function auditorMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): void {
    if (!req.user?.isAuditor) {
        res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de auditor.' });
        return;
    }
    next();
}
