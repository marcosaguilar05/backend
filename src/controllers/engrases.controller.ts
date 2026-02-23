import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

// ── CRUD ────────────────────────────────────────────────────────────────────

export const getEngrases = async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, conductor, placa, area_operacion, fecha_inicio, fecha_fin } = req.query as any;
        const from = (Number(page) - 1) * Number(limit);
        const to = from + Number(limit) - 1;

        let query = supabase.from('engrase_relaciones').select('*', { count: 'exact' });
        if (conductor) query = query.ilike('conductor', `%${conductor}%`);
        if (placa) query = query.eq('placa', placa);
        if (area_operacion) query = query.eq('area_operacion', area_operacion);
        if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha', fecha_fin);
        query = query.order('fecha', { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) return res.status(500).json({ error: error.message });

        res.json({
            data,
            pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) }
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener engrases' }); }
};

export const getEngraseById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('engrase_relaciones').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener engrase' }); }
};

export const createEngrase = async (req: AuthRequest, res: Response) => {
    try {
        const body = { ...req.body, creado_por: req.user.id };
        const { data, error } = await supabase.from('engrase').insert([body]).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) { res.status(500).json({ error: 'Error al crear engrase' }); }
};

export const updateEngrase = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const body = { ...req.body, actualizado_por: req.user.id, actualizado_en: new Date().toISOString() };
        const { data, error } = await supabase.from('engrase').update(body).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al actualizar engrase' }); }
};

export const deleteEngrase = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('engrase').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Engrase eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error al eliminar engrase' }); }
};

// ── FILTER OPTIONS ───────────────────────────────────────────────────────────

export const getEngraseFilterOptions = async (req: AuthRequest, res: Response) => {
    try {
        const [conductoresRes, placasRes, areasRes, engrasesRes] = await Promise.all([
            supabase.from('areas_conductores').select('conductor').order('conductor'),
            supabase.from('areas_placas').select('placa').eq('estado', 'ACTIVADA').order('placa'),
            supabase.from('areas_operacion').select('nombre').order('nombre'),
            supabase.from('engrase_relaciones').select('area_operacion'),
        ]);
        const unique = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
        res.json({
            conductores: unique((conductoresRes.data || []).map((c: any) => c.conductor)),
            placas: unique((placasRes.data || []).map((p: any) => p.placa)),
            areas_operacion: unique((areasRes.data || []).map((a: any) => a.nombre)),
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener opciones de filtro' }); }
};

// ── DASHBOARD ────────────────────────────────────────────────────────────────

export const getEngrasesDashboardKPIs = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('*');
        if (error) return res.status(500).json({ error: error.message });
        const rows = data || [];
        const totalGastado = rows.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
        const totalLavado = rows.reduce((s: number, r: any) => s + (Number(r.lavado) || 0), 0);
        const totalEngrase = rows.reduce((s: number, r: any) => s + (Number(r.engrase) || 0), 0);
        const totalOtros = rows.reduce((s: number, r: any) => s + (Number(r.otros) || 0), 0);
        res.json({
            totalGastado, totalLavado, totalEngrase, totalOtros,
            totalIntervenciones: rows.length,
            placasIntervenidas: new Set(rows.map((r: any) => r.placa)).size,
            conductoresActivos: new Set(rows.map((r: any) => r.conductor)).size,
            conLavado: rows.filter((r: any) => Number(r.lavado) > 0).length,
            conEngrase: rows.filter((r: any) => Number(r.engrase) > 0).length,
            conAmbos: rows.filter((r: any) => Number(r.lavado) > 0 && Number(r.engrase) > 0).length,
            promedioLavado: rows.length ? totalLavado / rows.length : 0,
            promedioEngrase: rows.length ? totalEngrase / rows.length : 0,
            promedioTotal: rows.length ? totalGastado / rows.length : 0,
        });
    } catch (e) { res.status(500).json({ error: 'Error en KPIs de dashboard' }); }
};

export const getEngrasesSpendingOverTime = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('fecha,lavado,engrase,otros,total').order('fecha');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const mes = r.fecha?.substring(0, 7);
            if (!mes) return;
            if (!map[mes]) map[mes] = { mes, lavado: 0, engrase: 0, otros: 0, total: 0, intervenciones: 0 };
            map[mes].lavado += Number(r.lavado) || 0;
            map[mes].engrase += Number(r.engrase) || 0;
            map[mes].otros += Number(r.otros) || 0;
            map[mes].total += Number(r.total) || 0;
            map[mes].intervenciones++;
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en gráfico de tiempo' }); }
};

export const getEngrasesServiceComparison = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('fecha,lavado,engrase').order('fecha');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const mes = r.fecha?.substring(0, 7);
            if (!mes) return;
            if (!map[mes]) map[mes] = { mes, lavado: 0, engrase: 0, countLavado: 0, countEngrase: 0 };
            if (Number(r.lavado) > 0) { map[mes].lavado += Number(r.lavado); map[mes].countLavado++; }
            if (Number(r.engrase) > 0) { map[mes].engrase += Number(r.engrase); map[mes].countEngrase++; }
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en comparación de servicios' }); }
};

export const getEngrasesByPlaca = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('*');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const p = r.placa;
            if (!map[p]) map[p] = { placa: p, conductor: r.conductor, totalLavado: 0, totalEngrase: 0, totalOtros: 0, totalAcumulado: 0, numLavados: 0, numEngrases: 0, numIntervenciones: 0, ultimaFecha: '' };
            map[p].totalLavado += Number(r.lavado) || 0;
            map[p].totalEngrase += Number(r.engrase) || 0;
            map[p].totalOtros += Number(r.otros) || 0;
            map[p].totalAcumulado += Number(r.total) || 0;
            if (Number(r.lavado) > 0) map[p].numLavados++;
            if (Number(r.engrase) > 0) map[p].numEngrases++;
            map[p].numIntervenciones++;
            if (!map[p].ultimaFecha || r.fecha > map[p].ultimaFecha) map[p].ultimaFecha = r.fecha;
        });
        res.json(Object.values(map).sort((a: any, b: any) => b.totalAcumulado - a.totalAcumulado));
    } catch (e) { res.status(500).json({ error: 'Error en datos por placa' }); }
};

export const getEngrasePlacaMonthly = async (req: AuthRequest, res: Response) => {
    try {
        const { placa } = req.params;
        const { data, error } = await supabase.from('engrase_relaciones').select('*').eq('placa', placa).order('fecha');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const mes = r.fecha?.substring(0, 7);
            if (!mes) return;
            if (!map[mes]) map[mes] = { fecha: mes, lavado: 0, engrase: 0, otros: 0, total: 0, tieneLabado: false, tieneEngrase: false, observaciones: [] };
            map[mes].lavado += Number(r.lavado) || 0;
            map[mes].engrase += Number(r.engrase) || 0;
            map[mes].otros += Number(r.otros) || 0;
            map[mes].total += Number(r.total) || 0;
            if (Number(r.lavado) > 0) map[mes].tieneLabado = true;
            if (Number(r.engrase) > 0) map[mes].tieneEngrase = true;
            if (r.observaciones) map[mes].observaciones.push(r.observaciones);
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en datos mensuales de placa' }); }
};

export const getEngrasesByArea = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('area_operacion,lavado,engrase,otros,total');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        let totalGlobal = 0;
        (data || []).forEach((r: any) => {
            const a = r.area_operacion || 'Sin área';
            if (!map[a]) map[a] = { area_operacion: a, totalLavado: 0, totalEngrase: 0, totalOtros: 0, totalGasto: 0, intervenciones: 0, porcentaje: 0 };
            map[a].totalLavado += Number(r.lavado) || 0;
            map[a].totalEngrase += Number(r.engrase) || 0;
            map[a].totalOtros += Number(r.otros) || 0;
            map[a].totalGasto += Number(r.total) || 0;
            map[a].intervenciones++;
            totalGlobal += Number(r.total) || 0;
        });
        const areas = Object.values(map).map((a: any) => ({ ...a, porcentaje: totalGlobal ? (a.totalGasto / totalGlobal) * 100 : 0 }));
        res.json({ areas, totalGlobal });
    } catch (e) { res.status(500).json({ error: 'Error en datos por área' }); }
};

export const getEngrasesAlerts = async (req: AuthRequest, res: Response) => {
    res.json([]);
};

export const getEngraseAlertRecords = async (req: AuthRequest, res: Response) => {
    res.json([]);
};

export const getEngrasesDetailedTable = async (req: AuthRequest, res: Response) => {
    const { page = 1, limit = 20 } = req.query as any;
    const from = (Number(page) - 1) * Number(limit);
    const to = from + Number(limit) - 1;
    const { data, error, count } = await supabase.from('engrase_relaciones').select('*', { count: 'exact' }).order('fecha', { ascending: false }).range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data, pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) } });
};

export const getEngrasesPlacaMonthMatrix = async (req: AuthRequest, res: Response) => {
    res.json({ meses: [], matrix: [] });
};

export const getEngrasesDashboardLink = async (req: AuthRequest, res: Response) => {
    res.json({ link: null });
};

export const getEngraseFinancialReport = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('*').order('fecha', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error en reporte financiero' }); }
};

export const getEngraseGeneralReport = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('engrase_relaciones').select('*').order('fecha', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error en reporte general' }); }
};
