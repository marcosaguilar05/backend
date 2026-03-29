import { Response } from 'express';
import { supabase, createAuthClient } from '../config/supabase';
import { AuthRequest, Tanqueo, TanqueoRelacion } from '../types';

// Caché simple en memoria para filter options (5 minutos)
let filterOptionsCache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const tanqueosController = {
    // Obtener todos los tanqueos con paginación y filtros
    async getAll(req: AuthRequest, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            // Filtros
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;
            const concepto = req.query.concepto as string;
            const tipo_operacion = req.query.tipo_operacion as string;
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;

            // Query base
            let query = supabase
                .from('tanqueo_relaciones')
                .select('*', { count: 'exact' });

            // Aplicar filtros
            if (conductor) {
                query = query.ilike('conductor', `%${conductor}%`);
            }
            if (placa) {
                query = query.ilike('placa', `%${placa}%`);
            }
            if (bomba) {
                query = query.ilike('bomba', `%${bomba}%`);
            }
            if (area_operacion) {
                query = query.ilike('area_operacion', `%${area_operacion}%`);
            }
            if (tipo_combustible) {
                query = query.eq('tipo_combustible', tipo_combustible);
            }
            if (concepto) {
                query = query.eq('concepto', concepto);
            }
            if (tipo_operacion) {
                query = query.eq('tipo_operacion', tipo_operacion);
            }
            if (fecha_inicio) {
                query = query.gte('fecha', fecha_inicio);
            }
            if (fecha_fin) {
                query = query.lte('fecha', fecha_fin);
            }

            // Ordenamiento
            const sort_by = (req.query.sort_by as string) || 'fecha';
            const sort_order = req.query.sort_order as string;
            const ascending = sort_order === 'asc';

            // Aplicar ordenamiento
            if (sort_order) {
                // Si hay un orden especificado, usarlo
                query = query.order(sort_by, { ascending }).order('id', { ascending: false });
            } else {
                // Por defecto: Fecha descendente
                query = query.order('fecha', { ascending: false }).order('id', { ascending: false });
            }

            const { data, error, count } = await query
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('Error en getAll:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            // Calcular totales de todos los registros que coinciden con los filtros (no solo la página actual)
            let summaryQuery = req.supabase?.from('tanqueo_relaciones').select('cantidad_galones, valor_tanqueo') || supabase.from('tanqueo_relaciones').select('cantidad_galones, valor_tanqueo');

            // Aplicar los mismos filtros para los totales
            if (conductor) summaryQuery = summaryQuery.ilike('conductor', `%${conductor}%`);
            if (placa) summaryQuery = summaryQuery.ilike('placa', `%${placa}%`);
            if (bomba) summaryQuery = summaryQuery.ilike('bomba', `%${bomba}%`);
            if (area_operacion) summaryQuery = summaryQuery.ilike('area_operacion', `%${area_operacion}%`);
            if (tipo_combustible) summaryQuery = summaryQuery.eq('tipo_combustible', tipo_combustible);
            if (concepto) summaryQuery = summaryQuery.eq('concepto', concepto);
            if (tipo_operacion) summaryQuery = summaryQuery.eq('tipo_operacion', tipo_operacion);
            if (fecha_inicio) summaryQuery = summaryQuery.gte('fecha', fecha_inicio);
            if (fecha_fin) summaryQuery = summaryQuery.lte('fecha', fecha_fin);

            const { data: summaryData } = await summaryQuery;

            // Calcular totales
            const totalGalones = summaryData?.reduce((sum, item) => sum + (item.cantidad_galones || 0), 0) || 0;
            const totalValor = summaryData?.reduce((sum, item) => sum + (item.valor_tanqueo || 0), 0) || 0;

            res.json({
                data: data as TanqueoRelacion[],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                },
                summary: {
                    total_galones: Math.round(totalGalones * 100) / 100,
                    total_valor: Math.round(totalValor * 100) / 100
                }
            });
        } catch (error) {
            console.error('Error obteniendo tanqueos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener valores únicos para los filtros - Con RLS aplicado
    async getFilterOptions(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Usar cliente autenticado para que RLS aplique automáticamente
            const dbClient = req.supabase || supabase;

            // Ejecutar queries en paralelo para mejorar rendimiento
            // Consultar directamente las tablas maestras para obtener valores disponibles según RLS
            const [
                conductoresRes,
                placasRes,
                bombasRes,
                areasRes,
                tiposCombustibleRes,
                tiposOperacionRes
            ] = await Promise.all([
                dbClient.from('areas_conductores').select('conductor').order('conductor'),
                dbClient.from('areas_placas').select('placa').eq('estado', 'ACTIVADA').order('placa'),
                dbClient.from('areas_bombas').select('bomba').eq('estado', 'ACTIVADA').order('bomba'),
                dbClient.from('areas_operacion').select('nombre').order('nombre'),
                dbClient.from('tanqueo_relaciones').select('tipo_combustible').not('tipo_combustible', 'is', null),
                dbClient.from('tanqueo_relaciones').select('tipo_operacion').not('tipo_operacion', 'is', null)
            ]);

            // Extraer valores únicos
            const conductores = [...new Set(conductoresRes.data?.map(t => t.conductor))].filter(Boolean).sort();
            const placas = [...new Set(placasRes.data?.map(t => t.placa))].filter(Boolean).sort();
            const bombas = [...new Set(bombasRes.data?.map(t => t.bomba))].filter(Boolean).sort();
            const areas = [...new Set(areasRes.data?.map(t => t.nombre))].filter(Boolean).sort();
            const tipos_combustible = [...new Set(tiposCombustibleRes.data?.map(t => t.tipo_combustible))].filter(Boolean).sort();
            const tipos_operacion = [...new Set(tiposOperacionRes.data?.map(t => t.tipo_operacion))].filter(Boolean).sort();

            const responseData = {
                conductores,
                placas,
                bombas,
                areas_operacion: areas,
                tipos_combustible,
                conceptos: ['OPERATIVO', 'ADMINISTRATIVO'],
                tipos_operacion
            };

            res.json(responseData);
        } catch (error) {
            console.error('Error obteniendo opciones de filtros:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // ... resto de las funciones (getById, create, update, delete) se mantienen igual

    async getById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const { data, error } = await supabase
                .from('tanqueo_relaciones')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data as TanqueoRelacion);
        } catch (error) {
            console.error('Error obteniendo tanqueo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async create(req: AuthRequest, res: Response): Promise<void> {
        try {
            const tipo_operacion = req.body.tipo_operacion || 'TANQUEO';

            // Datos base comunes
            const tanqueoData: Tanqueo = {
                fecha: req.body.fecha,
                bomba_id: parseInt(req.body.bomba_id),
                area_operacion_id: parseInt(req.body.area_operacion_id),
                concepto: req.body.concepto || 'OPERATIVO',
                tipo_operacion: tipo_operacion,
                observacion: req.body.observacion || null,
                creado_por: req.user?.id,
                saldo_disponible: req.body.saldo_disponible ? parseFloat(req.body.saldo_disponible) : null
            };

            if (tipo_operacion === 'ANTICIPO') {
                tanqueoData.valor_anticipo = parseFloat(req.body.valor_anticipo);
            } else {
                // TANQUEO
                tanqueoData.conductor_id = parseInt(req.body.conductor_id);
                tanqueoData.placa_id = parseInt(req.body.placa_id);
                tanqueoData.tipo_combustible = req.body.tipo_combustible || 'ACPM';
                tanqueoData.valor_tanqueo = parseFloat(req.body.valor_tanqueo);
                tanqueoData.cantidad_galones = parseFloat(req.body.cantidad_galones);
                tanqueoData.horometro = req.body.horometro ? parseFloat(req.body.horometro) : null;

                // Calcular costo por galón si es posible
                if (tanqueoData.valor_tanqueo && tanqueoData.cantidad_galones && tanqueoData.cantidad_galones > 0) {
                    tanqueoData.costo_por_galon = tanqueoData.valor_tanqueo / tanqueoData.cantidad_galones;
                }
            }

            const { data, error } = await supabase
                .from('tanqueo')
                .insert([tanqueoData])
                .select();

            if (error) {
                console.error('Error en create:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(201).json(data[0]);
        } catch (error) {
            console.error('Error creando tanqueo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async update(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const tipo_operacion = req.body.tipo_operacion || 'TANQUEO';

            const updateData: Partial<Tanqueo> = {
                fecha: req.body.fecha,
                bomba_id: parseInt(req.body.bomba_id),
                area_operacion_id: parseInt(req.body.area_operacion_id),
                concepto: req.body.concepto,
                tipo_operacion: tipo_operacion,
                observacion: req.body.observacion || null,
                saldo_disponible: req.body.saldo_disponible ? parseFloat(req.body.saldo_disponible) : null,
                actualizado_por: req.user?.id,
                actualizado_en: new Date().toISOString()
            };

            if (tipo_operacion === 'ANTICIPO') {
                updateData.valor_anticipo = parseFloat(req.body.valor_anticipo);
                updateData.conductor_id = null;
                updateData.placa_id = null;
                updateData.tipo_combustible = null;
                updateData.valor_tanqueo = null;
                updateData.cantidad_galones = null;
                updateData.horometro = null;
                updateData.costo_por_galon = null;
            } else {
                updateData.conductor_id = parseInt(req.body.conductor_id);
                updateData.placa_id = parseInt(req.body.placa_id);
                updateData.tipo_combustible = req.body.tipo_combustible || 'ACPM';
                updateData.valor_tanqueo = parseFloat(req.body.valor_tanqueo);
                updateData.cantidad_galones = parseFloat(req.body.cantidad_galones);
                updateData.horometro = req.body.horometro ? parseFloat(req.body.horometro) : null;
                updateData.valor_anticipo = null;

                if (updateData.valor_tanqueo && updateData.cantidad_galones && updateData.cantidad_galones > 0) {
                    updateData.costo_por_galon = updateData.valor_tanqueo / updateData.cantidad_galones;
                }
            }

            const { data, error } = await supabase
                .from('tanqueo')
                .update(updateData)
                .eq('id', id)
                .select();

            if (error) {
                console.error('Error en update:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            if (!data || data.length === 0) {
                res.status(404).json({ error: 'Tanqueo no encontrado' });
                return;
            }

            res.json(data[0]);
        } catch (error) {
            console.error('Error actualizando tanqueo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async delete(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            const { error } = await supabase
                .from('tanqueo')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error en delete:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: 'Tanqueo eliminado exitosamente' });
        } catch (error) {
            console.error('Error eliminando tanqueo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async deleteBatch(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                res.status(400).json({ error: 'No se enviaron IDs válidos para eliminar' });
                return;
            }

            const { error } = await supabase
                .from('tanqueo')
                .delete()
                .in('id', ids);

            if (error) {
                console.error('Error en deleteBatch:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: `${ids.length} registros eliminados exitosamente` });
        } catch (error) {
            console.error('Error eliminando tanqueos en lote:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getFinancialReport(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            // Otros filtros
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string; // Asumiendo Sub-Rubro
            const concepto = req.query.concepto as string;

            let query = supabase.from('tanqueo_financiero').select('*');

            // Filtros de fecha
            if (fecha_inicio) query = query.gte('Fecha de Creacion', fecha_inicio);
            if (fecha_fin) query = query.lte('Fecha de Creacion', fecha_fin);

            // Mapeo de filtros a columnas de la vista financiera
            if (conductor) query = query.ilike('Responsable', `%${conductor}%`);
            if (placa) query = query.ilike('Placa', `%${placa}%`);
            if (bomba) query = query.ilike('Tercero', `%${bomba}%`);
            if (area_operacion) query = query.ilike('Área de Operacion', `%${area_operacion}%`);
            if (concepto) query = query.eq('Concepto', concepto);
            if (tipo_combustible) query = query.ilike('Sub-Rubro', `%${tipo_combustible}%`);

            query = query.order('Fecha de Creacion', { ascending: false });

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching financial report:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error fetching financial report:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getExportData(req: AuthRequest, res: Response): Promise<void> {
        try {
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;
            const concepto = req.query.concepto as string;
            const tipo_operacion = req.query.tipo_operacion as string;
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;

            let query = supabase.from('tanqueo_relaciones').select('*');

            if (conductor) query = query.ilike('conductor', `%${conductor}%`);
            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (bomba) query = query.ilike('bomba', `%${bomba}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (tipo_combustible) query = query.eq('tipo_combustible', tipo_combustible);
            if (concepto) query = query.eq('concepto', concepto);
            if (tipo_operacion) query = query.eq('tipo_operacion', tipo_operacion);
            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);

            const hasFilters = conductor || placa || bomba || area_operacion || tipo_combustible || concepto || tipo_operacion;

            if (hasFilters) {
                query = query.order('id', { ascending: false });
            } else {
                query = query.order('fecha', { ascending: false }).order('id', { ascending: false });
            }

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getDashboardLink(req: AuthRequest, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'Usuario no autenticado' });
                return;
            }

            // 1. Obtener el area_operacion_id del usuario actual
            // Asumimos que hay una tabla 'usuarios' o 'profiles' extendida, o usamos public.users si supabase lo permite
            // Por ahora, asumiremos que se puede obtener de una tabla 'usuarios' o similar vinculada al auth.users
            // Si no existe tal tabla, el usuario debe aclarar. Pero basándonos en "area de operacion asiganada al usuario", debe existir.
            // INTENTO 1: Buscar en metadata del usuario Auth si está ahí, o en business logic.
            // Dado que no tengo acceso a la tabla usuarios, haré un query seguro:

            // NOTA: Si el modelo de usuario no está claro, usaré una lógica de fallback:
            // Intentar buscar un tablero default (area_operacion_id IS NULL)

            // Si el requerimiento dice "segun el area de operacion asignada al usuario", necesito saber esa area.
            // Voy a suponer que hay una tabla 'usuarios' donde id = user.id.

            const { data: userData, error: userError } = await supabase
                .from('usuarios') // Ajustar nombre de tabla si es diferente
                .select('area_operacion_id')
                .eq('id', userId)
                .single();

            // Si no se encuentra el usuario o error, asumimos sin área (null)
            const userAreaId = userData?.area_operacion_id || null;

            // 2. Buscar en tableros
            let query = supabase
                .from('tableros')
                .select('link')
                .limit(1);

            if (userAreaId) {
                // Si tiene área, buscar específico O general? El requerimiento dice "sino tiene id... ver ese link".
                // Interpretación: Si SU AREA tiene link, ver ese. Si no tiene area, ver el general.
                // Pero qué pasa si tiene área pero NO hay tablero para esa área? Probablemente fallback al general.

                // Primero intentamos match exacto
                const { data: specificBoard } = await supabase
                    .from('tableros')
                    .select('link')
                    .eq('area_operacion_id', userAreaId)
                    .single();

                if (specificBoard?.link) {
                    res.json({ link: specificBoard.link });
                    return;
                }
            }

            // Fallback: Default board
            const { data: defaultBoard } = await supabase
                .from('tableros')
                .select('link')
                .is('area_operacion_id', null)
                .single();

            res.json({ link: defaultBoard?.link || null });

        } catch (error) {
            console.error('Error obteniendo link tablero:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async importBatch(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { area_operacion_id, bomba_id, records } = req.body;
            let importedCount = 0;
            let errors: any[] = [];
            const userId = req.user?.id;

            // 1. Fetch catalogs
            // Corrected: Look into 'areas_placas' for plates and 'areas_conductores' for drivers
            const { data: allPlacas } = await supabase.from('areas_placas').select('id, placa').eq('estado', 'ACTIVADA').limit(10000);
            const { data: allConductores } = await supabase.from('areas_conductores').select('id, conductor').limit(10000);

            // Maps for lookup (Robust: Clean keys by removing non-alphanumeric)
            const cleanKey = (str: string) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').trim().toUpperCase() : '';

            const placaMap = new Map();
            allPlacas?.forEach((p: any) => {
                if (p.placa) placaMap.set(cleanKey(p.placa), p.id);
            });

            const conductorMap = new Map();
            allConductores?.forEach((c: any) => {
                if (c.conductor) conductorMap.set(cleanKey(c.conductor), c.id);
            });

            const recordsToInsert: any[] = [];

            // 2. Process records
            for (const [index, row] of records.entries()) {
                try {
                    const fechaStr = row['FECHA'];
                    const nombreConductor = row['NOMBRE CONDUCTOR']?.toString().trim().toUpperCase();
                    let placaStr = row['PLACA']?.toString().trim().toUpperCase() || '';

                    // Normalizar Placa: Si viene sin guion y tiene 6 caracteres (o estructura AAA123), intentar poner guion
                    // Check if format is AAANNN without hyphen
                    const placaRegexNoHyphen = /^([A-Z]{3})([0-9]{3})$/;
                    if (placaRegexNoHyphen.test(placaStr)) {
                        placaStr = placaStr.replace(placaRegexNoHyphen, '$1-$2');
                    } else {
                        // Some bikes have different format, but typically it is 3 letters 2 numbers 1 letter or 3 letters 2 numbers. 
                        // Let's also try generic insertion if length is 6
                        if (placaStr.length === 6 && !placaStr.includes('-')) {
                            placaStr = placaStr.slice(0, 3) + '-' + placaStr.slice(3);
                        }
                    }

                    const tipoCombustible = row['TIPO COMBUSTIBLE']?.toString().trim().toUpperCase();
                    const valorTanqueoStr = row['VALOR TANQUEO'];
                    const cantidadGalonesStr = row['CANTIDAD GALONES'];

                    if (!fechaStr || !placaStr || !valorTanqueoStr) {
                        errors.push({ index, error: 'Datos incompletos', row });
                        continue;
                    }

                    const cleanNumber = (val: any) => {
                        if (typeof val === 'number') return val;
                        return parseFloat(val.toString().replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
                    };

                    const valorTanqueo = cleanNumber(valorTanqueoStr);
                    const cantidadGalones = cleanNumber(cantidadGalonesStr);

                    let fechaIso = '';
                    if (typeof fechaStr === 'number') {
                        const date = new Date((fechaStr - (25567 + 2)) * 86400 * 1000);
                        fechaIso = date.toISOString().split('T')[0];
                    } else if (fechaStr.includes('/')) {
                        const [day, month, year] = fechaStr.split('/');
                        fechaIso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    } else {
                        fechaIso = new Date(fechaStr).toISOString().split('T')[0];
                    }

                    let placaId = placaMap.get(cleanKey(placaStr));
                    let conductorId = nombreConductor ? conductorMap.get(cleanKey(nombreConductor)) : null;

                    if (!placaId) {
                        // Retornar error especifico para que en el front sepa cuales placas fallaron
                        errors.push({
                            index,
                            error: `Placa no encontrada`,
                            detail: `La placa '${placaStr}' (original: ${row['PLACA']}) no existe en el sistema.`,
                            row
                        });
                        continue;
                    }

                    const record: any = {
                        fecha: fechaIso,
                        bomba_id: bomba_id,
                        area_operacion_id: area_operacion_id,
                        placa_id: placaId,
                        conductor_id: conductorId || null,
                        tipo_combustible: tipoCombustible || 'GASOLINA',
                        valor_tanqueo: valorTanqueo,
                        cantidad_galones: cantidadGalones,
                        tipo_operacion: 'TANQUEO',
                        concepto: 'OPERATIVO',
                        creado_por: userId
                    };

                    if (valorTanqueo && cantidadGalones > 0) {
                        record.costo_por_galon = valorTanqueo / cantidadGalones;
                    }

                    recordsToInsert.push(record);

                } catch (err: any) {
                    errors.push({ index, error: err.message, row });
                }
            }

            // 3. Insert
            if (recordsToInsert.length > 0) {
                const { error: insertError } = await supabase.from('tanqueo').insert(recordsToInsert);
                if (insertError) throw insertError;
                importedCount = recordsToInsert.length;
            }

            res.json({
                imported: importedCount,
                errors: errors,
                totalProcessed: records.length
            });

        } catch (error) {
            console.error('Error en importación:', error);
            res.status(500).json({ error: 'Error procesando el archivo' });
        }
    }
};