"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const supabase_1 = require("../config/supabase");
async function authMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            res.status(401).json({ error: 'Token no proporcionado' });
            return;
        }
        const { data: { user }, error } = await supabase_1.supabase.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ error: 'Token inválido' });
            return;
        }
        // Buscar información del usuario en la tabla usuarios
        const { data: userData, error: userError } = await supabase_1.supabase
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
        req.supabase = (0, supabase_1.createAuthClient)(token);
        next();
    }
    catch (error) {
        console.error('Error en auth middleware:', error);
        res.status(401).json({ error: 'Error de autenticación' });
    }
}
