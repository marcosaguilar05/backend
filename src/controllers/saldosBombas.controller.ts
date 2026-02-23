import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

export const getSaldosBombas = async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, area_operacion, bomba, actividad, sort_by = 'fecha', sort_order = 'desc' } = req.query as any;
        const from = (Number(page) - 1) * Number(limit);
        const to = from + Number(limit) - 1;

        let query = supabase.from('saldos_bombas_relaciones').select('*', { count: 'exact' });
        if (area_operacion) query = query.eq('area_operacion', area_operacion);
        if (bomba) query = query.eq('bomba', bomba);
        if (actividad) query = query.ilike('actividad', `%${actividad}%`);
        query = query.order(sort_by, { ascending: sort_order === 'asc' }).range(from, to);

        const { data, error, count } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.json({ data, pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) } });
    } catch (e) { res.status(500).json({ error: 'Error al obtener saldos' }); }
};

export const getSaldosBombasFilterOptions = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('saldos_bombas_relaciones').select('area_operacion, bomba, actividad');
        if (error) return res.status(500).json({ error: error.message });
        const rows = data || [];
        const unique = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
        res.json({
            areas: unique(rows.map((r: any) => r.area_operacion)),
            bombas: unique(rows.map((r: any) => r.bomba)),
            actividades: unique(rows.map((r: any) => r.actividad)),
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener filtros' }); }
};
