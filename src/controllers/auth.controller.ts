import { Request, Response } from 'express';
import { supabase, createAuthClient } from '../config/supabase';
import { AuthRequest, LoginRequest, LoginResponse, Usuario } from '../types';

export const authController = {
    async login(req: Request<{}, {}, LoginRequest>, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email y contraseña son requeridos' });
                return;
            }

            // Autenticar con Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                res.status(400).json({ error: authError.message });
                return;
            }

            // Obtener información del usuario desde la tabla usuarios
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData) {
                res.status(404).json({ error: 'Usuario no encontrado en la base de datos' });
                return;
            }

            // Verificar si es auditor usando maybeSingle en lugar de single, con el cliente global (seguro para roles admin)
            const { data: auditorData } = await supabase
                .from('Auditores')
                .select('id')
                .eq('id_usuario', authData.user.id)
                .maybeSingle();

            const response: LoginResponse = {
                user: {
                    id: authData.user.id,
                    email: userData.email,
                    nombre: userData.nombre,
                    rol: userData.rol,
                    isAuditor: !!auditorData
                },
                access_token: authData.session.access_token,
                refresh_token: authData.session.refresh_token,
                expires_at: authData.session.expires_at || 0,
                expires_in: authData.session.expires_in || 3600
            };

            res.json(response);
        } catch (error) {
            console.error('Error en login:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async logout(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { error } = await supabase.auth.signOut();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: 'Sesión cerrada exitosamente' });
        } catch (error) {
            console.error('Error en logout:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getUser(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { data: auditorData } = await supabase
                .from('Auditores')
                .select('id')
                .eq('id_usuario', req.user?.id)
                .maybeSingle();

            res.json({ user: { ...req.user, isAuditor: !!auditorData } });
        } catch (error) {
            console.error('Error obteniendo usuario:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};