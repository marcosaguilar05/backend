"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saldosBombasController = void 0;
const supabase_1 = require("../config/supabase");
exports.saldosBombasController = {
    async getAll(req, res) {
        try {
            const { page = 1, limit = 20, area_operacion, bomba, actividad, sort_by = 'saldo_disponible', sort_order = 'desc' } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;
            // Usar cliente autenticado para que RLS aplique
            const dbClient = req.supabase || supabase_1.supabase;
            let query = dbClient
                .from('saldos_bombas')
                .select('*', { count: 'exact' });
            // Filters
            if (area_operacion) {
                query = query.ilike('nombre_area_operacion', `%${area_operacion}%`);
            }
            if (bomba) {
                query = query.ilike('nombre_bomba', `%${bomba}%`);
            }
            // Por defecto solo mostrar activadas, a menos que se especifique filtro
            if (actividad) {
                query = query.eq('actividad', actividad);
            }
            else {
                query = query.eq('actividad', 'ACTIVADA');
            }
            // Sorting
            const ascending = sort_order === 'asc';
            query = query.order(sort_by, { ascending });
            // Pagination
            query = query.range(offset, offset + limitNum - 1);
            const { data, error, count } = await query;
            if (error)
                throw error;
            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
        }
        catch (error) {
            console.error('Error fetching saldos bombas:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async getFilterOptions(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
            const { data: areasData } = await dbClient
                .from('saldos_bombas')
                .select('nombre_area_operacion')
                .order('nombre_area_operacion');
            const areas = [...new Set(areasData?.map(a => a.nombre_area_operacion).filter(Boolean))];
            const { data: bombasData } = await dbClient
                .from('saldos_bombas')
                .select('nombre_bomba')
                .order('nombre_bomba');
            const bombas = [...new Set(bombasData?.map(b => b.nombre_bomba).filter(Boolean))];
            const { data: actividadData } = await dbClient
                .from('saldos_bombas')
                .select('actividad');
            const actividades = [...new Set(actividadData?.map(a => a.actividad).filter(Boolean))];
            res.json({ areas, bombas, actividades });
        }
        catch (error) {
            console.error('Error fetching filter options:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
