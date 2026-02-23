import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

export const getDocumentos = async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, placa, area_operacion, sort_by = 'fecha_vencimiento', sort_order = 'asc' } = req.query as any;
        const from = (Number(page) - 1) * Number(limit);
        const to = from + Number(limit) - 1;

        let query = supabase.from('documentos_relaciones').select('*', { count: 'exact' });
        if (placa) query = query.eq('placa', placa);
        if (area_operacion) query = query.eq('area_operacion', area_operacion);
        query = query.order(sort_by, { ascending: sort_order === 'asc' }).range(from, to);

        const { data, error, count } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.json({ data, pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) } });
    } catch (e) { res.status(500).json({ error: 'Error al obtener documentos' }); }
};

export const getDocumentoById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('documentos_relaciones').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener documento' }); }
};

export const createDocumento = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('documento').insert([req.body]).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) { res.status(500).json({ error: 'Error al crear documento' }); }
};

export const updateDocumento = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('documento').update(req.body).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al actualizar documento' }); }
};

export const deleteDocumento = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('documento').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Documento eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error al eliminar documento' }); }
};

export const getDocumentoFilterOptions = async (req: AuthRequest, res: Response) => {
    try {
        const [placasRes, areasRes] = await Promise.all([
            supabase.from('areas_placas').select('placa').eq('estado', 'ACTIVADA').order('placa'),
            supabase.from('areas_operacion').select('nombre').order('nombre'),
        ]);
        const unique = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
        res.json({
            placas: unique((placasRes.data || []).map((p: any) => p.placa)),
            areas_operacion: unique((areasRes.data || []).map((a: any) => a.nombre)),
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener filtros' }); }
};

// ── DASHBOARD ────────────────────────────────────────────────────────────────
const estadoDoc = (fechaVenc: string) => {
    const hoy = new Date();
    const venc = new Date(fechaVenc);
    const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
    if (dias < 0) return { estado: 'vencido', diasRestantes: dias, color: '#ef4444' };
    if (dias <= 15) return { estado: 'por_vencer', diasRestantes: dias, color: '#f97316' };
    if (dias <= 30) return { estado: 'proximo', diasRestantes: dias, color: '#eab308' };
    return { estado: 'vigente', diasRestantes: dias, color: '#22c55e' };
};

export const getDocumentosDashboardKPIs = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('documentos_relaciones').select('*');
        if (error) return res.status(500).json({ error: error.message });
        const rows = data || [];
        let vencidos = 0, porVencer = 0, proximos = 0, vigentes = 0;
        rows.forEach((r: any) => {
            const { estado } = estadoDoc(r.fecha_vencimiento);
            if (estado === 'vencido') vencidos++;
            else if (estado === 'por_vencer') porVencer++;
            else if (estado === 'proximo') proximos++;
            else vigentes++;
        });
        res.json({ totalVehiculos: new Set(rows.map((r: any) => r.vehiculo_id)).size, vencidos, porVencer, proximos, vigentes, sinDocumento: 0, totalDocumentos: rows.length });
    } catch (e) { res.status(500).json({ error: 'Error en KPIs' }); }
};

export const getDocumentosCalendar = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('documentos_relaciones').select('*').order('fecha_vencimiento');
        if (error) return res.status(500).json({ error: error.message });
        const events = (data || []).map((r: any) => {
            const { estado, diasRestantes, color } = estadoDoc(r.fecha_vencimiento);
            return { id: String(r.id), placa: r.placa, area_operacion: r.area_operacion, tipo_documento: r.tipo_documento, fecha: r.fecha_vencimiento, estado, diasRestantes, color, pdf: r.pdf_url || null };
        });
        res.json(events);
    } catch (e) { res.status(500).json({ error: 'Error en calendario' }); }
};

export const getDocumentosExpiringList = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('documentos_relaciones').select('*').order('fecha_vencimiento');
        if (error) return res.status(500).json({ error: error.message });
        const list = (data || [])
            .map((r: any) => { const { estado, diasRestantes, color } = estadoDoc(r.fecha_vencimiento); return { ...r, estado, diasRestantes, color, pdf: r.pdf_url || null }; })
            .filter((r: any) => r.diasRestantes <= 30);
        res.json(list);
    } catch (e) { res.status(500).json({ error: 'Error en lista de vencimientos' }); }
};

export const getDocumentosByArea = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('documentos_relaciones').select('*');
        if (error) return res.status(500).json({ error: error.message });
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => {
            const a = r.area_operacion || 'Sin área';
            if (!map[a]) map[a] = { area: a, total: 0, vencidos: 0, porVencer: 0, proximos: 0, vigentes: 0 };
            const { estado } = estadoDoc(r.fecha_vencimiento);
            map[a].total++;
            if (estado === 'vencido') map[a].vencidos++;
            else if (estado === 'por_vencer') map[a].porVencer++;
            else if (estado === 'proximo') map[a].proximos++;
            else map[a].vigentes++;
        });
        res.json(Object.values(map));
    } catch (e) { res.status(500).json({ error: 'Error en datos por área' }); }
};
