import { Router } from 'express';
import {
    getTanqueos,
    getTanqueoById,
    createTanqueo,
    updateTanqueo,
    deleteTanqueo,
    getConductores,
    getPlacas,
    getBombas,
    getAreasOperacion,
    getFilterOptions,
} from '../controllers/tanqueos.controller';
import { authenticateToken } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = Router();
router.use(authenticateToken);

// ── Rutas específicas ANTES de /:id ─────────────────────────────────────────
router.get('/filter-options', getFilterOptions);
router.get('/catalogos/conductores', getConductores);
router.get('/catalogos/placas', getPlacas);
router.get('/catalogos/bombas', getBombas);
router.get('/catalogos/areas', getAreasOperacion);

// Dashboard link
router.get('/dashboard-link', (_req, res) => res.json({ link: null }));

// Import
router.post('/import', async (req, res) => {
    try {
        const { records } = req.body;
        if (!records?.length) return res.status(400).json({ error: 'No hay registros para importar' });
        const { data, error } = await supabase.from('tanqueo').insert(records).select();
        if (error) return res.status(500).json({ error: error.message });
        res.json({ imported: data?.length || 0, errors: [] });
    } catch (e) { res.status(500).json({ error: 'Error al importar' }); }
});

// Saldo bomba
router.get('/catalogos/saldo-bomba', async (req: any, res) => {
    try {
        const { bombaId, fecha } = req.query;
        const { data, error } = await supabase.from('tanqueo_relaciones')
            .select('galones_ingresados,galones_consumidos')
            .eq('bomba_id', bombaId)
            .lte('fecha', fecha);
        if (error) return res.status(500).json({ error: error.message });
        const saldo = (data || []).reduce((s: number, r: any) =>
            s + (Number(r.galones_ingresados) || 0) - (Number(r.galones_consumidos) || 0), 0);
        res.json({ saldo });
    } catch (e) { res.status(500).json({ error: 'Error al obtener saldo' }); }
});

// Reportes
router.get('/reportes/financiero', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('*').order('fecha', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error en reporte financiero' }); }
});

router.get('/reportes/general', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('*').order('fecha', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error en reporte general' }); }
});

// Dashboard endpoints
router.get('/dashboard/kpis', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('galones,valor_total,placa,conductor');
        if (error) return res.status(500).json({ error: error.message });
        const rows = data || [];
        res.json({
            totalGalones: rows.reduce((s: number, r: any) => s + (Number(r.galones) || 0), 0),
            totalValor: rows.reduce((s: number, r: any) => s + (Number(r.valor_total) || 0), 0),
            totalRegistros: rows.length,
            vehiculosUnicos: new Set(rows.map((r: any) => r.placa)).size,
            conductoresUnicos: new Set(rows.map((r: any) => r.conductor)).size,
        });
    } catch (e) { res.status(500).json({ error: 'Error en KPIs' }); }
});

router.get('/dashboard/saldos-bombas', async (_req, res) => {
    try {
        const { data, error } = await supabase.from('areas_bombas').select('*').eq('estado', 'ACTIVADA');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error en saldos de bombas' }); }
});

router.get('/dashboard/consumption-over-time', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('fecha,galones,valor_total').order('fecha');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const mes = r.fecha?.substring(0, 7);
            if (!mes) return;
            if (!map[mes]) map[mes] = { mes, galones: 0, valor: 0, registros: 0 };
            map[mes].galones += Number(r.galones) || 0;
            map[mes].valor += Number(r.valor_total) || 0;
            map[mes].registros++;
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en consumo por tiempo' }); }
});

router.get('/dashboard/fuel-distribution', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('tipo_combustible,galones');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => {
            const t = r.tipo_combustible || 'Desconocido';
            map[t] = (map[t] || 0) + (Number(r.galones) || 0);
        });
        res.json(Object.entries(map).map(([tipo, galones]) => ({ tipo, galones })));
    } catch (e) { res.status(500).json({ error: 'Error en distribución de combustible' }); }
});

router.get('/dashboard/by-area', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('area_operacion,galones,valor_total');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const a = r.area_operacion || 'Sin área';
            if (!map[a]) map[a] = { area: a, galones: 0, valor: 0, registros: 0 };
            map[a].galones += Number(r.galones) || 0;
            map[a].valor += Number(r.valor_total) || 0;
            map[a].registros++;
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en datos por área' }); }
});

router.get('/dashboard/top-vehicles', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('placa,galones,valor_total');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            if (!map[r.placa]) map[r.placa] = { placa: r.placa, galones: 0, valor: 0, tanqueos: 0 };
            map[r.placa].galones += Number(r.galones) || 0;
            map[r.placa].valor += Number(r.valor_total) || 0;
            map[r.placa].tanqueos++;
        });
        res.json(Object.values(map).sort((a: any, b: any) => b.galones - a.galones).slice(0, 10));
    } catch (e) { res.status(500).json({ error: 'Error en top vehículos' }); }
});

router.get('/dashboard/vehicles-by-area', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('area_operacion,placa');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, Set<string>> = {};
        (data || []).forEach((r: any) => {
            const a = r.area_operacion || 'Sin área';
            if (!map[a]) map[a] = new Set();
            map[a].add(r.placa);
        });
        res.json(Object.entries(map).map(([area, placas]) => ({ area, cantidad: placas.size })));
    } catch (e) { res.status(500).json({ error: 'Error en vehículos por área' }); }
});

router.get('/dashboard/by-driver', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('conductor,galones,valor_total');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const c = r.conductor || 'Desconocido';
            if (!map[c]) map[c] = { conductor: c, galones: 0, valor: 0, tanqueos: 0 };
            map[c].galones += Number(r.galones) || 0;
            map[c].valor += Number(r.valor_total) || 0;
            map[c].tanqueos++;
        });
        res.json(Object.values(map).sort((a: any, b: any) => b.galones - a.galones));
    } catch (e) { res.status(500).json({ error: 'Error en datos por conductor' }); }
});

router.get('/dashboard/by-pump', async (req: any, res) => {
    try {
        const { data, error } = await supabase.from('tanqueo_relaciones').select('bomba,galones,valor_total');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const b = r.bomba || 'Desconocida';
            if (!map[b]) map[b] = { bomba: b, galones: 0, valor: 0, tanqueos: 0 };
            map[b].galones += Number(r.galones) || 0;
            map[b].valor += Number(r.valor_total) || 0;
            map[b].tanqueos++;
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en datos por bomba' }); }
});

router.get('/dashboard/alerts', (_req, res) => res.json([]));
router.get('/dashboard/alerts/:alertType/records', (_req, res) => res.json([]));

router.get('/dashboard/detailed-table', async (req: any, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const from = (Number(page) - 1) * Number(limit);
        const to = from + Number(limit) - 1;
        const { data, error, count } = await supabase.from('tanqueo_relaciones').select('*', { count: 'exact' }).order('fecha', { ascending: false }).range(from, to);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ data, pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) } });
    } catch (e) { res.status(500).json({ error: 'Error en tabla detallada' }); }
});

// ── CRUD (/:id al final) ─────────────────────────────────────────────────────
router.get('/', getTanqueos);
router.get('/:id', getTanqueoById);
router.post('/', createTanqueo);
router.put('/:id', updateTanqueo);
router.delete('/:id', deleteTanqueo);

export default router;
