"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncVehiculos = exports.getCatalogos = exports.getVehiculoDetalle = exports.getVehiculos = void 0;
const getVehiculos = async (req, res, next) => {
    try {
        console.log('GET /vehiculos request received');
        const empresa_id = req.query.empresa_id;
        const operacion_id = req.query.operacion_id;
        const placa = req.query.placa;
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
        let query = db.from('vehiculo').select(selectStr);
        if (empresa_id)
            query = query.eq('empresa_id', empresa_id);
        if (operacion_id)
            query = query.eq('operacion_id', operacion_id);
        if (placa) {
            query = query.ilike('areas_placas.placa', `%${placa}%`);
        }
        console.log('Executing query...');
        const { data, error } = await query;
        if (error) {
            console.error('Supabase Query Error:', error);
            throw error;
        }
        console.log(`Query successful. Returning ${data?.length} records.`);
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching vehiculos:', error);
        // Send explicit error to client for debugging
        res.status(500).json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.getVehiculos = getVehiculos;
const getVehiculoDetalle = async (req, res, next) => {
    try {
        const { id } = req.params;
        const db = req.supabase;
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
                    cat_marca_compactadora:cat_marca!vehiculo_caracteristicas_marca_compactadora_id_fkey ( nombre )
                )
            `)
            .eq('id', id)
            .single();
        if (error)
            throw error;
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching vehicle detail:', error);
        next(error);
    }
};
exports.getVehiculoDetalle = getVehiculoDetalle;
const getCatalogos = async (req, res, next) => {
    try {
        const db = req.supabase;
        const [marcas, tipos, clases, combustibles, marcasCompactadora] = await Promise.all([
            db.from('cat_marca').select('*'),
            db.from('cat_tipo_vehiculo').select('*'),
            db.from('cat_clase_vehiculo').select('*'),
            db.from('cat_combustible').select('*'),
            db.from('cat_marca_compactadora').select('*')
        ]);
        res.json({
            marcas: marcas.data,
            tipos: tipos.data,
            clases: clases.data,
            combustibles: combustibles.data,
            marcasCompactadora: marcasCompactadora.data
        });
    }
    catch (error) {
        console.error('Error fetching catalogs:', error);
        next(error);
    }
};
exports.getCatalogos = getCatalogos;
// New function to sync vehicles from areas_placas
const syncVehiculos = async (req, res, next) => {
    try {
        const db = req.supabase;
        // 1. Get all placas involved in active operations (or just all active placas)
        // Assuming we want to import ALL activated plates
        const { data: placas, error: placasError } = await db
            .from('areas_placas')
            .select('id, placa, estado')
            .eq('estado', 'ACTIVADA');
        if (placasError)
            throw placasError;
        if (!placas || placas.length === 0)
            return res.json({ message: 'No active plates found' });
        // 2. Get existing vehicles to avoid duplicates (though constraint check prevents it, we can filter)
        // constraint vehiculo_placa_id_key unique (placa_id)
        const { data: existing, error: existingError } = await db
            .from('vehiculo')
            .select('placa_id');
        if (existingError)
            throw existingError;
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
                .insert(toInsert);
            // .select() // No need to select all
            if (insertError)
                throw insertError;
            insertedCount = toInsert.length; // Approximate if no count returned
        }
        res.json({
            message: 'Sync successful',
            total_active_plates: placas.length,
            newly_synced: insertedCount,
            already_existing: existingPlacaIds.size
        });
    }
    catch (error) {
        console.error('Error syncing vehicles:', error);
        next(error);
    }
};
exports.syncVehiculos = syncVehiculos;
