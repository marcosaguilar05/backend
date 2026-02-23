import { Response, Request } from 'express';
import { supabase } from '../config/supabase';

export const catalogosController = {
    async getBombas(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('areas_bombas')
            .select('id, bomba')
            .eq('estado', 'ACTIVADA') // Asumiendo filtro de estado activo
            .order('bomba');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async getConductores(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('areas_conductores')
            .select('id, conductor')
            .order('conductor');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async getPlacas(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('areas_placas')
            .select('id, placa')
            .eq('estado', 'ACTIVADA')
            .order('placa');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async getAreas(req: Request, res: Response) {
        const { data, error } = await supabase
            .from('areas_operacion')
            .select('id, nombre')
            .order('nombre');

        if (error) return res.status(400).json({ error: error.message });
        res.json(data);
    },

    async getSaldoBomba(req: Request, res: Response) {
        try {
            const { bombaId, fecha } = req.query;

            if (!bombaId || !fecha) {
                res.status(400).json({ error: 'Bomba ID y fecha son requeridos' });
                return;
            }

            // Buscar el último registro para esa bomba en fecha <= fecha dada
            // Usamos tanqueo_relaciones para asegurar consistencia
            const { data, error } = await supabase
                .from('tanqueo_relaciones')
                .select('saldo_disponible')
                .eq('bomba_id', parseInt(bombaId as string))
                .lte('fecha', fecha)
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

        } catch (error) {
            console.error('Error en getSaldoBomba:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
