import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

// ==================== EVENTOS ====================

export const getEventos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { vehiculo_id, fecha_inicio, fecha_fin } = req.query;
        const db = req.supabase!;

        if (!db) {
            console.error('Supabase client is missing in request');
            return res.status(500).json({ error: 'Internal Server Error', details: 'Supabase client not initialized' });
        }

        console.log('Fetching eventos for vehiculo_id:', vehiculo_id);

        let query = db
            .from('mantenimiento_evento')
            .select(`
                id,
                fecha,
                km_evento,
                hr_evento,
                descripcion,
                observaciones,
                taller_id,
                costo,
                plan_id,
                plan_mantenimiento:plan_id ( id, nombre ),
                talleres:taller_id ( id, nombre:nombre_taller ),
                vehiculo:vehiculo_id (
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

        if (error) {
            console.error('Supabase error in getEventos:', error);
            // If the table doesn't exist, try the old one as fallback and log it
            if (error.code === '42P01') {
                console.warn('mantenimiento_evento table not found, attempting fallback to mantenimiento table');
                // (Optional fallback logic or just exit with clear error)
            }
            return res.status(500).json({
                error: 'Database error',
                message: error.message,
                hint: error.hint,
                details: error.details,
                code: error.code
            });
        }

        if (!data) {
            return res.json([]);
        }

        // Map to ensure clean response
        const mappedData = data.map((item: any) => ({
            ...item,
            talleres: item.talleres ? { ...item.talleres, nombre: item.talleres.nombre } : null
        }));

        res.json(mappedData);
    } catch (error) {
        console.error('Unexpected error in getEventos:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        });
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
                talleres ( id, nombre:nombre_taller )
            `)
            .single();

        if (error) {
            console.error('Error in createEvento Supabase:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        // Map if necessary
        const mappedData = {
            ...data,
            talleres: data.talleres ? { ...data.talleres, nombre: data.talleres.nombre } : null
        };

        res.status(201).json(mappedData);
    } catch (error) {
        console.error('Error in createEvento:', error);
        next(error);
    }
};

export const updateEvento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;
        const { vehiculo_id, fecha, km_evento, hr_evento, descripcion, observaciones, taller_id, plan_id, costo } = req.body;

        const updateData = {
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
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                plan_mantenimiento ( id, nombre ),
                talleres ( id, nombre:nombre_taller )
            `)
            .single();

        if (error) {
            console.error('Error in updateEvento Supabase:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        const mappedData = {
            ...data,
            talleres: data.talleres ? { ...data.talleres, nombre: data.talleres.nombre } : null
        };

        res.json(mappedData);
    } catch (error) {
        console.error('Error in updateEvento:', error);
        next(error);
    }
};

export const deleteEvento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;

        const { error } = await db
            .from('mantenimiento_evento')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error in deleteEvento Supabase:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }

        res.status(204).send();
    } catch (error) {
        console.error('Error in deleteEvento:', error);
        next(error);
    }
};

// ==================== PLANES ====================

export const getPlanes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { vehiculo_id, activo } = req.query;
        const db = req.supabase!;

        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        console.log('Fetching planes for vehiculo_id:', vehiculo_id);

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
        if (error) {
            console.error('Supabase error in getPlanes:', error);
            return res.status(500).json({ error: 'Database error', message: error.message, details: error });
        }

        res.json(data || []);
    } catch (error) {
        console.error('Unexpected error in getPlanes:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) });
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
        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        const { data, error } = await db.from('tipo_mantenimiento').select('*');
        if (error) {
            console.error('Error fetching tipos_mantenimiento:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.json(data || []);
    } catch (error) {
        console.error('Unexpected error in getTiposMantenimiento:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const createTipoMantenimiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        const { tipo, descripcion } = req.body;

        if (!tipo) {
            return res.status(400).json({ error: 'Validation error', message: 'El campo tipo es requerido' });
        }

        const { data, error } = await db
            .from('tipo_mantenimiento')
            .insert({ tipo, descripcion })
            .select()
            .single();

        if (error) {
            console.error('Error creating tipo_mantenimiento:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.status(201).json(data);
    } catch (error) {
        console.error('Unexpected error in createTipoMantenimiento:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTiposCondicion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        const { data, error } = await db.from('tipo_condicion').select('*');
        if (error) {
            console.error('Error fetching tipos_condicion:', error);
            return res.status(500).json({ error: 'Database error', message: error.message });
        }
        res.json(data || []);
    } catch (error) {
        console.error('Unexpected error in getTiposCondicion:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getProximosMantenimientos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        // Join with vehiculo and areas_placas to show the plate in the list
        const { data, error } = await db
            .from('v_proximo_mantenimiento')
            .select(`
                *,
                vehiculo:vehiculo_id (
                    id,
                    areas_placas ( placa )
                )
            `)
            .order('fecha_proximo', { ascending: true, nullsFirst: false });

        if (error) {
            console.error('Error fetching v_proximo_mantenimiento:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message,
                details: error
            });
        }
        res.json(data || []);
    } catch (error) {
        console.error('Unexpected error in getProximosMantenimientos:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTalleres = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        if (!db) return res.status(500).json({ error: 'Supabase client missing' });

        console.log('Fetching talleres...');
        // Try selecting all first to see if ciudad exists, or defensive selection
        const { data, error } = await db.from('talleres').select('*');

        if (error) {
            console.error('Error fetching talleres:', error);
            return res.status(500).json({
                error: 'Database error',
                message: error.message,
                details: error
            });
        }
        res.json(data || []);
    } catch (error) {
        console.error('Unexpected error in getTalleres:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
