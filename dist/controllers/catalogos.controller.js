"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catalogosController = void 0;
const supabase_1 = require("../config/supabase");
exports.catalogosController = {
    async getBombas(req, res) {
        const { data, error } = await (req.supabase || supabase_1.supabase)
            .from('areas_bombas')
            .select('id, bomba')
            .eq('estado', 'ACTIVADA') // Asumiendo filtro de estado activo
            .order('bomba');
        if (error)
            return res.status(400).json({ error: error.message });
        res.json(data);
    },
    async getConductores(req, res) {
        const { data, error } = await (req.supabase || supabase_1.supabase)
            .from('areas_conductores')
            .select('id, conductor')
            .order('conductor');
        if (error)
            return res.status(400).json({ error: error.message });
        res.json(data);
    },
    async getPlacas(req, res) {
        const { data, error } = await (req.supabase || supabase_1.supabase)
            .from('areas_placas')
            .select('id, placa')
            .eq('estado', 'ACTIVADA')
            .order('placa');
        if (error)
            return res.status(400).json({ error: error.message });
        res.json(data);
    },
    async getAreas(req, res) {
        const { data, error } = await (req.supabase || supabase_1.supabase)
            .from('areas_operacion')
            .select('id, nombre')
            .order('nombre');
        if (error)
            return res.status(400).json({ error: error.message });
        res.json(data);
    },
    async getEmpresas(req, res) {
        const { data, error } = await (req.supabase || supabase_1.supabase)
            .from('empresas')
            .select('id, empresa')
            .order('empresa');
        if (error)
            return res.status(400).json({ error: error.message });
        res.json(data);
    },
    async getSaldoBomba(req, res) {
        try {
            const { bombaId, fecha, excludeId } = req.query;
            if (!bombaId || !fecha) {
                res.status(400).json({ error: 'Bomba ID y fecha son requeridos' });
                return;
            }
            // Buscar el último registro para esa bomba en fecha <= fecha dada
            // Usamos tanqueo_relaciones para asegurar consistencia
            let dbQuery = (req.supabase || supabase_1.supabase)
                .from('tanqueo_relaciones')
                .select('saldo_disponible')
                .eq('bomba_id', parseInt(bombaId));
            if (excludeId) {
                // Si estamos editando, queremos el último saldo ANTES de este registro.
                // Es decir, registros con fecha menor, o con la misma fecha pero ID menor.
                dbQuery = dbQuery.or(`fecha.lt.${fecha},and(fecha.eq.${fecha},id.lt.${excludeId})`);
            }
            else {
                dbQuery = dbQuery.lte('fecha', fecha);
            }
            const { data, error } = await dbQuery
                .order('fecha', { ascending: false })
                .order('id', { ascending: false })
                .limit(1)
                .single();
            if (error) {
                // Si el error es "no rows", devolvemos saldo 0
                if (error.code === 'PGRST116') {
                    res.json({ saldo: 0 });
                    return;
                }
                console.error('Error fetching saldo:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            res.json({ saldo: data?.saldo_disponible || 0 });
        }
        catch (error) {
            console.error('Error en getSaldoBomba:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
