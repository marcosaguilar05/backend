import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña son requeridos' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        // Obtener información del usuario desde la tabla usuarios
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .single();

        if (userError) {
            return res.status(500).json({ error: 'Error al obtener datos del usuario' });
        }

        res.json({
            session: data.session,
            user: data.user,
            usuario: usuario,
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ message: 'Sesión cerrada exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No autorizado' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido' });
        }

        // Obtener información del usuario desde la tabla usuarios
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .single();

        if (userError) {
            return res.status(500).json({ error: 'Error al obtener datos del usuario' });
        }

        res.json({ user, usuario });
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
};