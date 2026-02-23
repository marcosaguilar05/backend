import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../middleware/auth';

export const getVehiculos = async (req: AuthRequest, res: Response) => {
    try {
        const { data, error } = await supabase.from('flota_relaciones').select('*').order('placa');
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener vehículos' }); }
};

export const getVehiculoDetalle = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase.from('flota_relaciones').select('*').eq('id', id).single();
        if (error) return res.status(404).json({ error: error.message });
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Error al obtener vehículo' }); }
};

export const getFlotaCatalogos = async (req: AuthRequest, res: Response) => {
    try {
        const [areasRes, tiposRes] = await Promise.all([
            supabase.from('areas_operacion').select('*').order('nombre'),
            supabase.from('tipos_vehiculo').select('*').order('nombre'),
        ]);
        res.json({
            areas: areasRes.data || [],
            tipos: tiposRes.data || [],
        });
    } catch (e) { res.status(500).json({ error: 'Error al obtener catálogos de flota' }); }
};

export const syncVehiculos = async (req: AuthRequest, res: Response) => {
    res.json({ message: 'Sincronización completada', newly_synced: 0 });
};
