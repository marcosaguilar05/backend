import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

export const getFilterOptions = async (req: AuthRequest, res: Response) => {
    try {
        const [conductoresRes, placasRes, bombasRes, areasRes, tanqueosRes] = await Promise.all([
            supabase.from('areas_conductores').select('conductor').order('conductor'),
            supabase.from('areas_placas').select('placa').eq('estado', 'ACTIVADA').order('placa'),
            supabase.from('areas_bombas').select('bomba').eq('estado', 'ACTIVADA').order('bomba'),
            supabase.from('areas_operacion').select('nombre').order('nombre'),
            supabase.from('tanqueo_relaciones').select('tipo_combustible, concepto, tipo_operacion'),
        ]);

        if (conductoresRes.error || placasRes.error || bombasRes.error || areasRes.error) {
            return res.status(500).json({ error: 'Error al obtener opciones de filtro' });
        }

        const tanqueos = tanqueosRes.data || [];

        const unique = (arr: (string | null | undefined)[]) =>
            [...new Set(arr.filter(Boolean))].sort() as string[];

        res.json({
            conductores: unique(conductoresRes.data?.map((c: any) => c.conductor)),
            placas: unique(placasRes.data?.map((p: any) => p.placa)),
            bombas: unique(bombasRes.data?.map((b: any) => b.bomba)),
            areas_operacion: unique(areasRes.data?.map((a: any) => a.nombre)),
            tipos_combustible: unique(tanqueos.map((t: any) => t.tipo_combustible)),
            conceptos: unique(tanqueos.map((t: any) => t.concepto)),
            tipos_operacion: unique(tanqueos.map((t: any) => t.tipo_operacion)),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener opciones de filtro' });
    }
};

export const getTanqueos = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('tanqueo_relaciones')
            .select('*')
            .order('fecha', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tanqueos' });
    }
};

export const getTanqueoById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('tanqueo_relaciones')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener tanqueo' });
    }
};

export const createTanqueo = async (req: AuthRequest, res: Response) => {
    try {
        const tanqueoData = req.body;

        // Agregar el usuario que creó el registro
        tanqueoData.creado_por = req.user.id;

        const { data, error } = await supabase
            .from('tanqueo')
            .insert([tanqueoData])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al crear tanqueo' });
    }
};

export const updateTanqueo = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const tanqueoData = req.body;

        // Agregar el usuario que actualizó el registro
        tanqueoData.actualizado_por = req.user.id;
        tanqueoData.actualizado_en = new Date().toISOString();

        const { data, error } = await supabase
            .from('tanqueo')
            .update(tanqueoData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar tanqueo' });
    }
};

export const deleteTanqueo = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('tanqueo')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ message: 'Tanqueo eliminado exitosamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar tanqueo' });
    }
};

// Controladores para obtener catálogos
export const getConductores = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('areas_conductores')
            .select('*')
            .order('conductor');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener conductores' });
    }
};

export const getPlacas = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('areas_placas')
            .select('*')
            .eq('estado', 'ACTIVADA')
            .order('placa');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener placas' });
    }
};

export const getBombas = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('areas_bombas')
            .select('*')
            .eq('estado', 'ACTIVADA')
            .order('bomba');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener bombas' });
    }
};

export const getAreasOperacion = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase
            .from('areas_operacion')
            .select('*')
            .order('nombre');

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener áreas de operación' });
    }
};