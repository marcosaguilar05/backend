import { Response } from 'express';
import { supabase, adminSupabase } from '../config/supabase';
import { AuthRequest } from '../types';

export const adminController = {
    // ==================== AREAS BOMBAS ====================
    async getBombas(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_bombas')
            .select(`
                *,
                area_operacion:areas_operacion!area_operacion_id(id, nombre),
                area_operacion_secundario:areas_operacion!area_operacion_id_secundario(id, nombre),
                area_operacion_tecero:areas_operacion!area_operacion_id_tecero(id, nombre)
            `)
            .order('bomba');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async createBomba(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_bombas')
            .insert(req.body)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    },

    async updateBomba(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { data, error } = await adminSupabase
            .from('areas_bombas')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async deleteBomba(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { error } = await adminSupabase
            .from('areas_bombas')
            .delete()
            .eq('id', id);

        if (error) return res.status(400).json({ error: error.message });
        res.status(204).send();
    },

    // ==================== AREAS CONDUCTORES ====================
    async getConductores(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_conductores')
            .select(`
                *,
                area_operacion:areas_operacion!area_principal(id, nombre)
            `)
            .order('conductor');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async createConductor(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_conductores')
            .insert(req.body)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    },

    async updateConductor(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { data, error } = await adminSupabase
            .from('areas_conductores')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async deleteConductor(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { error } = await adminSupabase
            .from('areas_conductores')
            .delete()
            .eq('id', id);

        if (error) return res.status(400).json({ error: error.message });
        res.status(204).send();
    },

    // ==================== AREAS OPERACION ====================
    async getAreas(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_operacion')
            .select(`
                *,
                empresa:empresas!empresa_id(id, empresa)
            `)
            .order('nombre');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async createArea(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_operacion')
            .insert(req.body)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    },

    async updateArea(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { data, error } = await adminSupabase
            .from('areas_operacion')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async deleteArea(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { error } = await adminSupabase
            .from('areas_operacion')
            .delete()
            .eq('id', id);

        if (error) return res.status(400).json({ error: error.message });
        res.status(204).send();
    },

    // ==================== AREAS PLACAS ====================
    async getPlacas(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_placas')
            .select('*')
            .order('placa');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async createPlaca(req: AuthRequest, res: Response) {
        const { data, error } = await adminSupabase
            .from('areas_placas')
            .insert(req.body)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.status(201).json(data);
    },

    async updatePlaca(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { data, error } = await adminSupabase
            .from('areas_placas')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async deletePlaca(req: AuthRequest, res: Response) {
        const { id } = req.params;
        const { error } = await adminSupabase
            .from('areas_placas')
            .delete()
            .eq('id', id);

        if (error) return res.status(400).json({ error: error.message });
        res.status(204).send();
    }
};
