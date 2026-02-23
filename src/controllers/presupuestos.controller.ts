import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

// ── CATÁLOGOS ────────────────────────────────────────────────────────────────

export const getRubros = async (req: AuthRequest, res: Response) => {
    try {
        let query = supabase.from('maestro_rubros').select('*');
        if (req.query.tipo) query = query.eq('tipo', req.query.tipo);
        if (req.query.nivel) query = query.eq('nivel', req.query.nivel);
        if (req.query.padre_id) query = query.eq('padre_id', req.query.padre_id);
        const { data, error } = await query.order('nombre');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener rubros' }); }
};

export const getTipos = async (req: AuthRequest, res: Response) => {
    try {
        let query = supabase.from('tipos_presupuesto').select('*');
        if (req.query.padre_id) query = query.eq('padre_id', req.query.padre_id);
        const { data, error } = await query.order('nombre');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener tipos' }); }
};

export const getConceptos = async (req: AuthRequest, res: Response) => {
    try {
        let query = supabase.from('conceptos_presupuesto').select('*');
        if (req.query.tipo_id) query = query.eq('tipo_id', req.query.tipo_id);
        const { data, error } = await query.order('nombre');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener conceptos' }); }
};

export const getPresupuestoFilterOptions = async (req: AuthRequest, res: Response) => {
    try {
        const [areasRes, empresasRes, aniosRes] = await Promise.all([
            supabase.from('areas_operacion').select('nombre').order('nombre'),
            supabase.from('presupuestos').select('empresa'),
            supabase.from('presupuestos').select('anio_vigencia'),
        ]);
        const unique = (arr: (string | null | undefined)[]) => [...new Set(arr.filter(Boolean))].sort() as string[];
        res.json({
            areas: unique((areasRes.data || []).map((a: any) => a.nombre)),
            empresas: unique((empresasRes.data || []).map((p: any) => p.empresa)),
            anios: unique((aniosRes.data || []).map((p: any) => String(p.anio_vigencia))),
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener filtros' }); }
};

// ── CRUD PRESUPUESTOS ────────────────────────────────────────────────────────

export const getPresupuestos = async (req: AuthRequest, res: Response) => {
    try {
        const { page = 1, limit = 20, ...filters } = req.query as any;
        const from = (Number(page) - 1) * Number(limit);
        const to = from + Number(limit) - 1;

        let query = supabase.from('presupuestos').select('*', { count: 'exact' });
        if (filters.area) query = query.eq('area_operacion', filters.area);
        if (filters.empresa) query = query.eq('empresa', filters.empresa);
        if (filters.anio) query = query.eq('anio_vigencia', filters.anio);
        query = query.order('created_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;
        if (error) return res.status(500).json({ error: error.message });
        res.json({ data, pagination: { page: Number(page), limit: Number(limit), total: count || 0, totalPages: Math.ceil((count || 0) / Number(limit)) } });
    } catch (e) { res.status(500).json({ error: 'Error al obtener presupuestos' }); }
};

export const getPresupuestoById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('presupuestos').select('*, presupuesto_items(*)').eq('id', id).single();
        if (error) return res.status(404).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener presupuesto' }); }
};

export const createPresupuesto = async (req: AuthRequest, res: Response) => {
    try {
        const { items, ...body } = req.body;
        const { data, error } = await supabase.from('presupuestos').insert([body]).select().single();
        if (error) return res.status(500).json({ error: error.message });
        if (items?.length) {
            const itemsWithId = items.map((item: any) => ({ ...item, presupuesto_id: (data as any).id }));
            await supabase.from('presupuesto_items').insert(itemsWithId);
        }
        res.status(201).json(data);
    } catch (e) { res.status(500).json({ error: 'Error al crear presupuesto' }); }
};

export const updatePresupuesto = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('presupuestos').update(req.body).eq('id', id).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al actualizar presupuesto' }); }
};

export const deletePresupuesto = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('presupuestos').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Presupuesto eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error al eliminar presupuesto' }); }
};

// ── ITEMS ────────────────────────────────────────────────────────────────────

export const addPresupuestoItem = async (req: AuthRequest, res: Response) => {
    try {
        const { presupuestoId } = req.params;
        const { data, error } = await supabase.from('presupuesto_items').insert([{ ...req.body, presupuesto_id: presupuestoId }]).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) { res.status(500).json({ error: 'Error al agregar ítem' }); }
};

export const updatePresupuestoItem = async (req: AuthRequest, res: Response) => {
    try {
        const { itemId } = req.params;
        const { data, error } = await supabase.from('presupuesto_items').update(req.body).eq('id', itemId).select().single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al actualizar ítem' }); }
};

export const deletePresupuestoItem = async (req: AuthRequest, res: Response) => {
    try {
        const { itemId } = req.params;
        const { error } = await supabase.from('presupuesto_items').delete().eq('id', itemId);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ message: 'Ítem eliminado' });
    } catch (e) { res.status(500).json({ error: 'Error al eliminar ítem' }); }
};
