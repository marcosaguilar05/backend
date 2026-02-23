"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenController = void 0;
const supabase_1 = require("../config/supabase");
exports.refreshTokenController = {
    async refresh(req, res) {
        try {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                res.status(400).json({ error: 'Refresh token es requerido' });
                return;
            }
            // Refresh session with Supabase
            const { data, error } = await supabase_1.supabase.auth.refreshSession({
                refresh_token
            });
            if (error || !data.session) {
                res.status(401).json({ error: 'Refresh token inválido o expirado' });
                return;
            }
            const response = {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at || 0,
                expires_in: data.session.expires_in || 3600
            };
            res.json(response);
        }
        catch (error) {
            console.error('Error en refresh token:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
