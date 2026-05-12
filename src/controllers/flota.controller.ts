import { Response, NextFunction } from 'express';
import { AuthRequest, Vehiculo, VehiculoCaracteristicas, CatMarca, CatTipoVehiculo, CatClaseVehiculo, CatCombustible, CatMarcaCompactadora } from '../types';

export const getVehiculos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        console.log('GET /vehiculos request received');
        const empresa_id = req.query.empresa_id as string;
        const operacion_id = req.query.operacion_id as string;
        const placa = req.query.placa as string;
        
        // Pagination setup
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        if (!req.supabase) {
            console.error('req.supabase is undefined in getVehiculos');
            throw new Error('Supabase client not initialized in request');
        }
        const db = req.supabase;
        console.log('Supabase client initialized');

        // Standard query
        let selectStr = `
            id,
            placa_id,
            empresa_id,
            operacion_id,
            areas_placas${placa ? '!inner' : ''} ( placa ),
            empresas ( empresa ),
            areas_operacion ( nombre ),
            vehiculo_caracteristicas (
                clase_vehiculo_id,
                cat_clase_vehiculo ( nombre ),
                marca_id,
                cat_marca:cat_marca!vehiculo_caracteristicas_marca_id_fkey ( nombre ),
                anio:año
            )
        `;

        let query = db.from('vehiculo').select(selectStr, { count: 'exact' });

        if (empresa_id) query = query.eq('empresa_id', empresa_id);
        if (operacion_id) query = query.eq('operacion_id', operacion_id);
        if (placa) {
            // Because areas_placas is marked as !inner if placa is present, this ilike filter works.
            query = query.ilike('areas_placas.placa', `%${placa}%`);
        }

        console.log('Executing query...');
        const { data, count, error } = await query
            .range(offset, offset + limit - 1)
            .order('empresa_id', { ascending: false, nullsFirst: false })
            .order('operacion_id', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Supabase Query Error:', error);
            throw error;
        }

        console.log(`Query successful. Returning ${data?.length} records of ${count} total.`);
        
        res.json({
            data,
            pagination: {
                total: count || 0,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching vehiculos:', error);
        // Send explicit error to client for debugging
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};

export const getVehiculoDetalle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;

        const { data, error } = await db
            .from('vehiculo')
            .select(`
                *,
                areas_placas ( placa ),
                empresas ( empresa ),
                areas_operacion ( nombre ),
                vehiculo_caracteristicas (
                    *,
                    anio:año,
                    cat_marca:cat_marca!vehiculo_caracteristicas_marca_id_fkey ( nombre ),
                    cat_tipo_vehiculo:cat_tipo_vehiculo!vehiculo_caracteristicas_tipo_vehiculo_id_fkey ( nombre ),
                    cat_clase_vehiculo:cat_clase_vehiculo!vehiculo_caracteristicas_clase_vehiculo_id_fkey ( nombre ),
                    cat_combustible:cat_combustible!vehiculo_caracteristicas_combustible_id_fkey ( nombre ),
                    cat_marca_compactadora ( nombre )
                )
            `)
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error fetching vehicle detail:', error);
        next(error);
    }
};

export const getCatalogos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;

        const [marcas, tipos, clases, combustibles, marcasCompactadora, empresas, operaciones, placas] = await Promise.all([
            db.from('cat_marca').select('*'),
            db.from('cat_tipo_vehiculo').select('*'),
            db.from('cat_clase_vehiculo').select('*'),
            db.from('cat_combustible').select('*'),
            db.from('cat_marca_compactadora').select('*'),
            db.from('empresas').select('id, empresa').order('empresa'),
            db.from('areas_operacion').select('id, nombre').order('nombre'),
            db.from('areas_placas').select('id, placa').eq('estado', 'ACTIVADA').order('placa')
        ]);

        // Filter plates that are already in the vehiculo table
        const { data: existingVehicles } = await db.from('vehiculo').select('placa_id');
        const existingPlacaIds = new Set(existingVehicles?.map(v => v.placa_id));
        
        // Use all placas if you want, but available are those not in vehiculo
        const placasData = placas.data || [];
        const placasDisponibles = placasData.filter(p => !existingPlacaIds.has(p.id));

        res.json({
            marcas: marcas.data || [],
            tipos: tipos.data || [],
            clases: clases.data || [],
            combustibles: combustibles.data || [],
            marcasCompactadora: marcasCompactadora.data || [],
            empresas: empresas.data || [],
            operaciones: operaciones.data || [],
            placas: placasData,
            placasDisponibles: placasDisponibles
        });
    } catch (error) {
        console.error('Error fetching catalogs:', error);
        next(error);
    }
};

// New function to sync vehicles from areas_placas
export const syncVehiculos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;

        // 1. Get all placas involved in active operations (or just all active placas)
        // Assuming we want to import ALL activated plates
        const { data: placas, error: placasError } = await db
            .from('areas_placas')
            .select('id, placa, estado')
            .eq('estado', 'ACTIVADA');

        if (placasError) throw placasError;
        if (!placas || placas.length === 0) return res.json({ message: 'No active plates found' });

        // 2. Get existing vehicles to avoid duplicates (though constraint check prevents it, we can filter)
        // constraint vehiculo_placa_id_key unique (placa_id)
        const { data: existing, error: existingError } = await db
            .from('vehiculo')
            .select('placa_id');

        if (existingError) throw existingError;

        const existingPlacaIds = new Set(existing?.map(v => v.placa_id));

        // 3. Prepare inserts
        const toInsert = placas
            .filter(p => !existingPlacaIds.has(p.id))
            .map(p => ({
                placa_id: p.id,
                // We don't have company or operation info here unless we infer it?
                // For now, insert as raw records.
            }));

        let insertedCount = 0;
        if (toInsert.length > 0) {
            const { error: insertError, count } = await db
                .from('vehiculo')
                .insert(toInsert)
            // .select() // No need to select all

            if (insertError) throw insertError;
            insertedCount = toInsert.length; // Approximate if no count returned
        }

        res.json({
            message: 'Sync successful',
            total_active_plates: placas.length,
            newly_synced: insertedCount,
            already_existing: existingPlacaIds.size
        });

    } catch (error) {
        console.error('Error syncing vehicles:', error);
        next(error);
    }
};

export const updateVehiculoCaracteristicas = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;
        const body = req.body as Partial<VehiculoCaracteristicas>;

        // Build the row to upsert — always include vehiculo_id as it is the PK
        const row: Record<string, any> = { vehiculo_id: Number(id) };

        const allowedFields = [
            'marca_id', 'tipo_vehiculo_id', 'clase_vehiculo_id',
            'combustible_id', 'marca_compactadora_id',
            'nro_ejes', 'nro_llantas', 'año', 'linea', 'nro_serie',
            'estado', 'sub_estado'
        ];

        for (const field of allowedFields) {
            if (field in body) {
                row[field] = (body as any)[field];
            }
        }

        const { data, error } = await db
            .from('vehiculo_caracteristicas')
            .upsert(row, { onConflict: 'vehiculo_id' })
            .select(`
                *,
                anio:año,
                cat_marca:cat_marca!vehiculo_caracteristicas_marca_id_fkey ( nombre ),
                cat_tipo_vehiculo:cat_tipo_vehiculo!vehiculo_caracteristicas_tipo_vehiculo_id_fkey ( nombre ),
                cat_clase_vehiculo:cat_clase_vehiculo!vehiculo_caracteristicas_clase_vehiculo_id_fkey ( nombre ),
                cat_combustible:cat_combustible!vehiculo_caracteristicas_combustible_id_fkey ( nombre ),
                cat_marca_compactadora ( nombre )
            `)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Error updating vehiculo caracteristicas:', error);
        next(error);
    }
};

export const createVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const { placa_id, empresa_id, operacion_id } = req.body;

        if (!placa_id) {
            return res.status(400).json({ error: 'La placa es obligatoria' });
        }

        // Check if already exists
        const { data: existing } = await db
            .from('vehiculo')
            .select('id')
            .eq('placa_id', placa_id)
            .maybeSingle();

        if (existing) {
            return res.status(400).json({ error: 'Este vehículo (placa) ya está registrado en la flota' });
        }

        const { data, error } = await db
            .from('vehiculo')
            .insert({
                placa_id,
                empresa_id: empresa_id || null,
                operacion_id: operacion_id || null
            })
            .select()
            .single();

        if (error) throw error;

        // Create initial characteristics record
        await db.from('vehiculo_caracteristicas').insert({ vehiculo_id: data.id });

        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating vehiculo:', error);
        next(error);
    }
};

export const deleteVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;

        // Delete characteristics first (due to FK)
        await db.from('vehiculo_caracteristicas').delete().eq('vehiculo_id', id);

        // Delete vehicle
        const { error } = await db
            .from('vehiculo')
            .delete()
            .eq('id', id);

        if (error) {
            if (error.code === '23503') {
                return res.status(400).json({ 
                    error: 'No se puede eliminar el vehículo porque tiene registros asociados (tanqueos, mantenimientos, etc.)' 
                });
            }
            throw error;
        }

        res.json({ message: 'Vehículo eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting vehiculo:', error);
        next(error);
    }
};
