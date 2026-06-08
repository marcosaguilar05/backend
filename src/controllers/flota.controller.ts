import { Response, NextFunction } from 'express';
import { AuthRequest, Vehiculo, VehiculoCaracteristicas, CatMarca, CatTipoVehiculo, CatClaseVehiculo, CatCombustible, CatMarcaCompactadora } from '../types';

export const getVehiculos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        console.log('GET /vehiculos request received');
        const empresa_id = req.query.empresa_id as string;
        const operacion_id = req.query.operacion_id as string;
        const asignado_a = req.query.asignado_a as string;
        const placa = req.query.placa as string; // Contiene el término general de búsqueda
        
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

        // Standard query — cargamos todas las relaciones necesarias para el filtro inteligente
        let selectStr = `
            id,
            placa_id,
            empresa_id,
            operacion_id,
            asignado_a,
            areas_placas ( placa ),
            empresas ( empresa ),
            areas_operacion ( nombre ),
            vehiculo_caracteristicas (
                clase_vehiculo_id,
                cat_clase_vehiculo ( nombre ),
                tipo_vehiculo_id,
                cat_tipo_vehiculo:cat_tipo_vehiculo!vehiculo_caracteristicas_tipo_vehiculo_id_fkey ( nombre ),
                marca_id,
                cat_marca:cat_marca!vehiculo_caracteristicas_marca_id_fkey ( nombre ),
                anio:año
            )
        `;

        let query = db.from('vehiculo').select(selectStr);

        if (empresa_id) query = query.eq('empresa_id', empresa_id);
        if (operacion_id) query = query.eq('operacion_id', operacion_id);
        if (asignado_a) query = query.eq('asignado_a', asignado_a);

        console.log('Executing query...');
        const { data, error } = await query
            .order('empresa_id', { ascending: false, nullsFirst: false })
            .order('operacion_id', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false });

        if (error) {
            console.error('Supabase Query Error:', error);
            throw error;
        }

        // Filtro general en memoria para búsqueda inteligente (soporta placa, marca, tipo, clase, empresa, área)
        let filteredData = data || [];
        if (placa) {
            const searchTerm = placa.toLowerCase().trim();
            filteredData = filteredData.filter((v: any) => {
                // 1. Placa
                const placaData = Array.isArray(v.areas_placas) ? v.areas_placas[0] : v.areas_placas;
                const pVal = placaData?.placa || v.placa || '';
                if (pVal.toLowerCase().includes(searchTerm)) return true;

                // 2. Empresa
                const empData = Array.isArray(v.empresas) ? v.empresas[0] : v.empresas;
                const empVal = empData?.empresa || '';
                if (empVal.toLowerCase().includes(searchTerm)) return true;

                // 3. Área de Operación
                const areaData = Array.isArray(v.areas_operacion) ? v.areas_operacion[0] : v.areas_operacion;
                const areaVal = areaData?.nombre || '';
                if (areaVal.toLowerCase().includes(searchTerm)) return true;

                // 4. Marca
                const chars = Array.isArray(v.vehiculo_caracteristicas) ? v.vehiculo_caracteristicas[0] : v.vehiculo_caracteristicas;
                const marcaVal = chars?.cat_marca?.nombre || '';
                if (marcaVal.toLowerCase().includes(searchTerm)) return true;

                // 5. Clase / Tipo
                const claseVal = chars?.cat_clase_vehiculo?.nombre || '';
                const tipoVal = chars?.cat_tipo_vehiculo?.nombre || '';
                if (claseVal.toLowerCase().includes(searchTerm) || tipoVal.toLowerCase().includes(searchTerm)) return true;

                return false;
            });
        }

        const total = filteredData.length;
        const paginatedData = filteredData.slice(offset, offset + limit);

        console.log(`Query successful. Returning ${paginatedData.length} records of ${total} total.`);
        
        res.json({
            data: paginatedData,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching vehiculos:', error);
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
                areas_placas ( placa, estado ),
                empresas ( empresa ),
                areas_operacion ( nombre ),
                vehiculo_caracteristicas (
                    *,
                    anio:año,
                    cat_marca:cat_marca!vehiculo_caracteristicas_marca_id_fkey ( nombre ),
                    cat_tipo_vehiculo:cat_tipo_vehiculo!vehiculo_caracteristicas_tipo_vehiculo_id_fkey ( nombre ),
                    cat_clase_vehiculo:cat_clase_vehiculo!vehiculo_caracteristicas_clase_vehiculo_id_fkey ( nombre ),
                    cat_combustible:cat_combustible!vehiculo_caracteristicas_combustible_id_fkey ( nombre ),
                    cat_marca_compactadora ( nombre ),
                    Estado
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

        const [marcas, tipos, clases, combustibles, marcasCompactadora, empresas, operaciones, placas, asignadosResult] = await Promise.all([
            db.from('cat_marca').select('*'),
            db.from('cat_tipo_vehiculo').select('*'),
            db.from('cat_clase_vehiculo').select('*'),
            db.from('cat_combustible').select('*'),
            db.from('cat_marca_compactadora').select('*'),
            db.from('empresas').select('id, empresa').order('empresa'),
            db.from('areas_operacion').select('id, nombre').order('nombre'),
            db.from('areas_placas').select('id, placa').eq('estado', 'ACTIVADA').order('placa'),
            db.from('vehiculo').select('asignado_a').not('asignado_a', 'is', null)
        ]);

        // Filter plates that are already in the vehiculo table
        const { data: existingVehicles } = await db.from('vehiculo').select('placa_id');
        const existingPlacaIds = new Set(existingVehicles?.map(v => v.placa_id));
        
        // Use all placas if you want, but available are those not in vehiculo
        const placasData = placas.data || [];
        const placasDisponibles = placasData.filter(p => !existingPlacaIds.has(p.id));

        const asignadosSet = new Set<string>();
        if (asignadosResult?.data) {
            asignadosResult.data.forEach((v: any) => {
                if (v.asignado_a) asignadosSet.add(v.asignado_a);
            });
        }
        const asignados = Array.from(asignadosSet).sort().map(a => ({ id: a, nombre: a }));

        res.json({
            marcas: marcas.data || [],
            tipos: tipos.data || [],
            clases: clases.data || [],
            combustibles: combustibles.data || [],
            marcasCompactadora: marcasCompactadora.data || [],
            empresas: empresas.data || [],
            operaciones: operaciones.data || [],
            placas: placasData,
            placasDisponibles: placasDisponibles,
            asignados: asignados
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
            'nro_ejes', 'nro_llantas', 'año', 'linea', 'nro_serie', 'Estado'
        ];

        for (const field of allowedFields) {
            if (field in body) {
                row[field] = (body as any)[field];
            }
        }

        // Handle anio/año synonym from frontend
        if ('anio' in body && !('año' in body)) {
            row['año'] = (body as any).anio;
        }

        console.log('Upserting vehicle characteristics for ID:', id, row);

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
                cat_marca_compactadora ( nombre ),
                Estado
            `)
            .single();

        if (error) {
            console.error('Supabase Error in updateVehiculoCaracteristicas:', error);
            return res.status(500).json({ 
                error: 'Database error', 
                message: error.message,
                details: error.details,
                hint: error.hint
            });
        }

        res.json(data);
    } catch (error) {
        console.error('Unexpected error in updateVehiculoCaracteristicas:', error);
        next(error);
    }
};

export const updateVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;
        const { placa_id, empresa_id, operacion_id, asignado_a } = req.body;

        const { data, error } = await db
            .from('vehiculo')
            .update({
                placa_id,
                empresa_id,
                operacion_id,
                asignado_a
            })
            .eq('id', id)
            .select(`
                *,
                areas_placas ( placa, estado ),
                empresas ( empresa ),
                areas_operacion ( nombre )
            `)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating vehicle relations:', error);
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
