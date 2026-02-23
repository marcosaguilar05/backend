import { Response, NextFunction } from 'express';
import { supabase, createAuthClient } from '../config/supabase';
import { AuthRequest, Usuario } from '../types';

export async function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            res.status(401).json({ error: 'Token no proporcionado' });
            return;
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            res.status(401).json({ error: 'Token inválido' });
            return;
        }

        // Buscar información del usuario en la tabla usuarios
        const { data: userData, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            res.status(401).json({ error: 'Usuario no encontrado en la base de datos' });
            return;
        }

        req.user = {
            id: user.id,
            email: userData.email,
            nombre: userData.nombre,
            rol: userData.rol
        };

        // Guardar token y crear cliente autenticado para RLS
        req.accessToken = token;
        req.supabase = createAuthClient(token);

        next();
    } catch (error) {
        console.error('Error en auth middleware:', error);
        res.status(401).json({ error: 'Error de autenticación' });
    }
}