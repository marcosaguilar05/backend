import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

// ==================== EVENTOS ====================

export const getEventos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { vehiculo_id, fecha_inicio, fecha_fin, tipo } = req.query;
        const db = req.supabase!;

        let query = db
            .from('mantenimiento')
            .select(`
                id,
                fecha_entrada,
                km,
                hr,
                actividad,
                nota,
                taller_id,
                areas_placas!mantenimiento_placa_id_fkey (
                    id,
                    placa
                ),
                talleres!mantenimiento_taller_id_fkey ( nombre )
            `)
            .order('fecha_entrada', { ascending: false });

        if (vehiculo_id) {
            // Get placa_id from vehiculo table first
            const { data: vehiculo, error: vError } = await db
                .from('vehiculo')
                .select('placa_id')
                .eq('id', vehiculo_id)
                .single();

            if (vError) throw vError;
            if (vehiculo) {
                query = query.eq('placa_id', vehiculo.placa_id);
            }
        }

        if (fecha_inicio) query = query.gte('fecha_entrada', fecha_inicio);
        if (fecha_fin) query = query.lte('fecha_entrada', fecha_fin);

        const { data, error } = await query;
        if (error) throw error;

        // Map to frontend expectation
        const mappedData = data.map((item: any) => ({
            id: item.id,
            fecha: item.fecha_entrada,
            km_evento: item.km,
            hr_evento: item.hr,
            descripcion: item.actividad,
            observaciones: item.nota,
            taller_id: item.taller_id,
            talleres: item.talleres,
            costo: 0, // Not in schema
            plan_mantenimiento: null, // Not in schema
            vehiculo: {
                areas_placas: item.areas_placas
            }
        }));

        res.json(mappedData);
    } catch (error) {
        next(error);
    }
};

export const createEvento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { vehiculo_id, fecha, km_evento, hr_evento, descripcion, observaciones, taller_id, plan_id, costo } = req.body;

        // Get placa_id from vehiculo
        const { data: vehiculo, error: vError } = await db
            .from('vehiculo')
            .select('placa_id')
            .eq('id', vehiculo_id)
            .single();

        if (vError) throw vError;
        if (!vehiculo) throw new Error('Vehículo no encontrado');

        const insertData = {
            placa_id: vehiculo.placa_id,
            fecha_entrada: fecha,
            km: km_evento,
            hr: hr_evento,
            actividad: descripcion,
            nota: observaciones,
            taller_id: taller_id || null
            // costo AND plan_id are ignored as they don't exist in mantenimiento table
        };

        const { data, error } = await db
            .from('mantenimiento')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;

        // Map response back
        const responseData = {
            id: data.id,
            fecha: data.fecha_entrada,
            km_evento: data.km,
            hr_evento: data.hr,
            descripcion: data.actividad,
            observaciones: data.nota,
            taller_id: data.taller_id,
            costo: 0,
            plan_mantenimiento: null
        };

        res.status(201).json(responseData);
    } catch (error) {
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
