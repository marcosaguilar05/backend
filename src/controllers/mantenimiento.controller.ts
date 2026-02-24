import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

// ==================== EVENTOS ====================

export const getEventos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { vehiculo_id, fecha_inicio, fecha_fin } = req.query;
        const db = req.supabase!;

        let query = db
            .from('mantenimiento_evento')
            .select(`
                *,
                plan_mantenimiento ( id, nombre ),
                talleres ( id, nombre ),
                vehiculo (
                    id,
                    areas_placas ( id, placa )
                )
            `)
            .order('fecha', { ascending: false });

        if (vehiculo_id) {
            query = query.eq('vehiculo_id', vehiculo_id);
        }

        if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha', fecha_fin);

        const { data, error } = await query;
        if (error) throw error;

        // Map to frontend expectation if necessary (though the schema now matches better)
        const mappedData = data.map((item: any) => ({
            id: item.id,
            fecha: item.fecha,
            km_evento: item.km_evento,
            hr_evento: item.hr_evento,
            descripcion: item.descripcion,
            observaciones: item.observaciones,
            taller_id: item.taller_id,
            talleres: item.talleres,
            costo: item.costo,
            plan_id: item.plan_id,
            plan_mantenimiento: item.plan_mantenimiento,
            vehiculo_id: item.vehiculo_id,
            vehiculo: item.vehiculo
        }));

        res.json(mappedData);
    } catch (error) {
        console.error('Error in getEventos:', error);
        next(error);
    }
};

export const createEvento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { vehiculo_id, fecha, km_evento, hr_evento, descripcion, observaciones, taller_id, plan_id, costo } = req.body;

        const insertData = {
            vehiculo_id,
            fecha,
            km_evento,
            hr_evento,
            descripcion,
            observaciones,
            taller_id: taller_id || null,
            plan_id: plan_id || null,
            costo: costo || 0
        };

        const { data, error } = await db
            .from('mantenimiento_evento')
            .insert(insertData)
            .select(`
                *,
                plan_mantenimiento ( id, nombre ),
                talleres ( id, nombre )
            `)
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Error in createEvento:', error);
        next(error);
    }
};

// ==================== PLANES ====================

export const getPlanes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { vehiculo_id, activo } = req.query;
        const db = req.supabase!;

        let query = db
            .from('plan_mantenimiento')
            .select(`
                *,
                tipo_mantenimiento ( tipo ),
                plan_condicion (
                    *,
                    tipo_condicion ( nombre, codigo )
                )
            `);

        if (vehiculo_id) query = query.eq('vehiculo_id', vehiculo_id);
        if (activo !== undefined) query = query.eq('activo', activo === 'true');

        const { data, error } = await query;
        if (error) throw error;

        res.json(data);
    } catch (error) {
        next(error);
    }
};

export const updatePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;
        const { condiciones, ...planData } = req.body;

        // 1. Update Plan Basic Info
        const { data: plan, error: planError } = await db
            .from('plan_mantenimiento')
            .update(planData)
            .eq('id', id)
            .select()
            .single();

        if (planError) throw planError;

        // 2. Update Conditions
        // Strategy: Delete all existing conditions for this plan and re-insert active ones
        // (Simpler than diffing)
        if (condiciones) {
            const { error: deleteError } = await db
                .from('plan_condicion')
                .delete()
                .eq('plan_id', id);

            if (deleteError) throw deleteError;

            if (condiciones.length > 0) {
                const condicionesWithPlan = condiciones.map((c: any) => ({
                    plan_id: id,
                    tipo_condicion_id: c.tipo_condicion_id,
                    valor: c.valor,
                    unidad: c.unidad
                }));

                const { error: insertError } = await db
                    .from('plan_condicion')
                    .insert(condicionesWithPlan);

                if (insertError) throw insertError;
            }
        }

        res.json(plan);
    } catch (error) {
        console.error('Error updating plan:', error);
        next(error);
    }
};

export const createPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { condiciones, ...planData } = req.body;

        // Start transaction (Supabase doesn't support traditional transactions via JS client easily, so we go sequential)
        // 1. Create Plan
        const { data: plan, error: planError } = await db
            .from('plan_mantenimiento')
            .insert(planData)
            .select()
            .single();

        if (planError) throw planError;

        // 2. Create Conditions if any
        if (condiciones && condiciones.length > 0) {
            const condicionesWithPlan = condiciones.map((c: any) => ({
                plan_id: plan.id,
                tipo_condicion_id: c.tipo_condicion_id,
                valor: c.valor,
                unidad: c.unidad
            }));
            const { error: condError } = await db
                .from('plan_condicion')
                .insert(condicionesWithPlan);

            if (condError) {
                // Rollback plan creation (best effort)
                await db.from('plan_mantenimiento').delete().eq('id', plan.id);
                throw condError;
            }
        }

        res.status(201).json(plan);
    } catch (error) {
        next(error);
    }
};

export const getTiposMantenimiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { data, error } = await db.from('tipo_mantenimiento').select('*');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        next(error);
    }
};

export const getTalleres = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { data, error } = await db.from('talleres').select('id, nombre, ciudad');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        next(error);
    }
};
