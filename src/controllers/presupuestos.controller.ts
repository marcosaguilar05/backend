import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest, Presupuesto, PresupuestoItem } from '../types';

export const presupuestosController = {
    // ==================== CATÁLOGOS ====================

    // Obtener maestro de rubros
    async getRubros(req: AuthRequest, res: Response): Promise<void> {
        try {
            const tipo = req.query.tipo as string;
            const nivel = req.query.nivel as string;
            const padre_id = req.query.padre_id as string;

            let query = (req.supabase || supabase)
                .from('maestro_rubros')
                .select('*')
                .eq('activo', true)
                .order('codigo');

            if (tipo) query = query.eq('tipo', tipo);
            if (nivel) query = query.eq('nivel', parseInt(nivel));
            if (padre_id) query = query.eq('rubro_padre_id', parseInt(padre_id));

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en getRubros:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener tipos de presupuesto
    async getTipos(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { padre_id } = req.query;
            let query = (req.supabase || supabase)
                .from('tipos_presupuesto')
                .select('*')
                .eq('activo', true)
                .order('nombre');

            if (padre_id) {
                query = query.eq('padre', Number(padre_id));
            }

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en getTipos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener conceptos por tipo
    async getConceptos(req: AuthRequest, res: Response): Promise<void> {
        try {
            const tipo_id = req.query.tipo_id as string;

            let query = (req.supabase || supabase)
                .from('conceptos_presupuesto')
                .select('*')
                .eq('activo', true)
                .order('nombre');

            if (tipo_id) query = query.eq('tipo_presupuesto_id', parseInt(tipo_id));

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en getConceptos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Crear nuevo tipo de presupuesto (Solo ADMIN)
    async createTipo(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { nombre, descripcion, padre_id } = req.body;

            if (!nombre || !padre_id) {
                res.status(400).json({ error: 'Nombre y rubro padre son requeridos' });
                return;
            }

            const { data, error } = await dbClient
                .from('tipos_presupuesto')
                .insert({
                    nombre,
                    descripcion,
                    padre: padre_id,
                    activo: true
                })
                .select()
                .single();

            if (error) {
                console.error('Error de Supabase en createTipo:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(201).json(data);
        } catch (error) {
            console.error('Error en createTipo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Crear nuevo concepto de presupuesto (Solo ADMIN)
    async createConcepto(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { nombre, unidad, tipo_presupuesto_id } = req.body;

            if (!nombre || !tipo_presupuesto_id) {
                res.status(400).json({ error: 'Nombre y tipo de presupuesto son requeridos' });
                return;
            }

            const { data, error } = await dbClient
                .from('conceptos_presupuesto')
                .insert({
                    nombre,
                    unidad,
                    tipo_presupuesto_id,
                    activo: true
                })
                .select()
                .single();

            if (error) {
                console.error('Error de Supabase en createConcepto:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(201).json(data);
        } catch (error) {
            console.error('Error en createConcepto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // ==================== PRESUPUESTOS ====================

    // Listar presupuestos con paginación
    async getAll(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const {
                page = 1,
                limit = 20,
                empresa,
                vehiculo_id,
                placa,
                area_operacion,
                anio,
                grupo_rubro,
                rubro,
                sub_rubro,
                sort_by = 'id',
                sort_order = 'desc'
            } = req.query;

            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;

            // Resolve area_operacion names to IDs
            let areaIds: number[] = [];
            if (area_operacion && area_operacion !== 'undefined' && area_operacion !== '') {
                const { data: areaData, error: areaError } = await dbClient
                    .from('areas_operacion')
                    .select('id')
                    .ilike('nombre', (area_operacion as string).trim());
                
                if (areaError) console.error('Error resolving area_operacion:', areaError);
                areaIds = areaData?.map(a => a.id) || [];
                console.log(`[Presupuestos Filter] Area: "${area_operacion}" -> ${areaIds}`);
            }

            // Resolve empresa names to IDs
            let empresaIds: number[] = [];
            if (empresa && empresa !== 'undefined' && empresa !== '') {
                const { data: empresaData, error: empresaError } = await dbClient
                    .from('empresas')
                    .select('id')
                    .ilike('empresa', (empresa as string).trim());
                
                if (empresaError) console.error('Error resolving empresa:', empresaError);
                empresaIds = empresaData?.map(e => e.id) || [];
                console.log(`[Presupuestos Filter] Empresa: "${empresa}" -> ${empresaIds}`);
            }

            // Resolve grupo_rubro names to IDs
            let grupoRubroIds: number[] = [];
            if (grupo_rubro && grupo_rubro !== 'undefined' && grupo_rubro !== '') {
                const { data: grupoData, error: grupoError } = await dbClient
                    .from('maestro_rubros')
                    .select('id')
                    .ilike('nombre', (grupo_rubro as string).trim());
                
                if (grupoError) console.error('Error resolving grupo_rubro:', grupoError);
                grupoRubroIds = grupoData?.map(g => g.id) || [];
                console.log(`[Presupuestos Filter] Grupo (L1): "${grupo_rubro}" -> ${grupoRubroIds}`);
            }

            // Resolve rubro names to IDs
            let rubroIds: number[] = [];
            if (rubro && rubro !== 'undefined' && rubro !== '') {
                const { data: rData, error: rError } = await dbClient
                    .from('maestro_rubros')
                    .select('id')
                    .ilike('nombre', (rubro as string).trim());
                
                if (rError) console.error('Error resolving rubro:', rError);
                rubroIds = rData?.map(r => r.id) || [];
                console.log(`[Presupuestos Filter] Rubro (L2): "${rubro}" -> ${rubroIds}`);
            }

            // Resolve sub_rubro names STRICTLY to item types (Level 3) to avoid collision with Rubro (Level 2)
            let budgetIdsFromTipo: number[] = [];
            if (sub_rubro && sub_rubro !== 'undefined' && sub_rubro !== '') {
                const subRubroName = (sub_rubro as string).trim();

                // Resolve all matches from tipos_presupuesto (the item-level definition)
                const { data: tipoData, error: tipoError } = await dbClient
                    .from('tipos_presupuesto')
                    .select('id')
                    .ilike('nombre', subRubroName);

                if (tipoError) console.error('Error resolving sub_rubro from tipos_presupuesto:', tipoError);

                if (tipoData && tipoData.length > 0) {
                    const tipoIds = tipoData.map(t => t.id);
                    // Match found in items table!
                    const { data: itemData, error: itemError } = await dbClient
                        .from('presupuesto_items')
                        .select('presupuesto_id')
                        .in('tipo_presupuesto_id', tipoIds);
                    
                    if (itemError) console.error('Error finding budgets for tipo_presupuesto:', itemError);
                    if (itemData && itemData.length > 0) {
                        budgetIdsFromTipo = [...new Set(itemData.map(d => Number(d.presupuesto_id)))];
                    }
                }

                console.log(`[Presupuestos Filter] Sub Rubro (L3): "${sub_rubro}" -> BudgetIDsWithTipoCount: ${budgetIdsFromTipo.length}`);

                if (budgetIdsFromTipo.length === 0) {
                    console.warn(`Could not resolve sub_rubro (L3): ${sub_rubro} in item types`);
                }
            }

            // Resolve placa to vehiculo ID
            let vehiculoIdFromPlaca: number | null = null;
            if (placa && placa !== 'undefined' && placa !== '') {
                // Find placa_id first
                const { data: placaData } = await dbClient
                    .from('areas_placas')
                    .select('id')
                    .eq('placa', placa as string)
                    .maybeSingle();

                if (placaData) {
                    // Find vehiculo_id from control_flota using placa_id
                    const { data: vData } = await dbClient
                        .from('control_flota')
                        .select('id')
                        .eq('placa_id', placaData.id)
                        .maybeSingle();

                    vehiculoIdFromPlaca = vData?.id || null;
                }
            }

            // 1. Consulta principal para la tabla (paginada)
            let query = dbClient
                .from('presupuestos')
                .select(`
                    *,
                    control_flota(
                        id, 
                        placa_id,
                        clase_vehiculo,
                        areas_placas(id, placa)
                    ),
                    areas_operacion(id, nombre),
                    empresas(id, empresa),
                    grupo:maestro_rubros!grupo_rubro_id(id, codigo, nombre),
                    rubro:maestro_rubros!rubro_id(id, codigo, nombre),
                    personal:Personal!presupuestos_empleado_id_fkey(id, tipo),
                    presupuesto_items(id, valor_total, ejecutado, tipo:tipos_presupuesto(id, nombre))
                `, { count: 'exact' });

            // Filtros directos por ID
            if (vehiculo_id) query = query.eq('vehiculo_id', Number(vehiculo_id));
            if (anio && anio !== 'undefined' && anio !== '') query = query.eq('anio', Number(anio));

            // Filtros por ID resuelto
            // Filtros por IDs resueltos (si se proporcionó un nombre pero no se encontró un ID, forzamos -1 para 0 resultados)
            if (area_operacion && area_operacion !== '' && area_operacion !== 'undefined') {
                if (areaIds.length > 0) query = query.in('area_operacion_id', areaIds);
                else query = query.eq('area_operacion_id', -1);
            }
            if (empresa && empresa !== '' && empresa !== 'undefined') {
                if (empresaIds.length > 0) query = query.in('empresa_id', empresaIds);
                else query = query.eq('empresa_id', -1);
            }
            if (grupo_rubro && grupo_rubro !== '' && grupo_rubro !== 'undefined') {
                if (grupoRubroIds.length > 0) query = query.in('grupo_rubro_id', grupoRubroIds);
                else query = query.eq('grupo_rubro_id', -1);
            }
            if (rubro && rubro !== '' && rubro !== 'undefined') {
                if (rubroIds.length > 0) query = query.in('rubro_id', rubroIds);
                else query = query.eq('rubro_id', -1);
            }
            if (sub_rubro && sub_rubro !== '' && sub_rubro !== 'undefined') {
                if (budgetIdsFromTipo.length > 0) {
                    query = query.in('id', budgetIdsFromTipo);
                } else {
                    query = query.eq('id', -1);
                }
            }
            if (vehiculoIdFromPlaca !== null) {
                query = query.eq('vehiculo_id', vehiculoIdFromPlaca);
            }

            const ascending = sort_order === 'asc';
            query = query.order(sort_by as string, { ascending });
            query = query.range(offset, offset + limitNum - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('❌ Error de Supabase en getAll Presupuestos:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            // 2. Cálculo de estadísticas reales (sin paginación, pero con los mismos filtros base)
            // Note: Summary needs to filter by IDs, so we need to look up IDs if filtering by name
            // For simplicity, we'll just filter by anio and estado for summary (the main filters)
            let summaryQuery = dbClient
                .from('presupuestos')
                .select('id, rubro_id, presupuesto_items(estado, valor_total, ejecutado)');

            if (vehiculo_id) summaryQuery = summaryQuery.eq('vehiculo_id', Number(vehiculo_id));
            if (vehiculoIdFromPlaca !== null) summaryQuery = summaryQuery.eq('vehiculo_id', vehiculoIdFromPlaca);
            if (anio && anio !== 'undefined' && anio !== '') summaryQuery = summaryQuery.eq('anio', Number(anio));

            // Sync filters with the table results
            if (area_operacion && area_operacion !== '' && area_operacion !== 'undefined') {
                if (areaIds.length > 0) summaryQuery = summaryQuery.in('area_operacion_id', areaIds);
                else summaryQuery = summaryQuery.eq('area_operacion_id', -1);
            }
            if (empresa && empresa !== '' && empresa !== 'undefined') {
                if (empresaIds.length > 0) summaryQuery = summaryQuery.in('empresa_id', empresaIds);
                else summaryQuery = summaryQuery.eq('empresa_id', -1);
            }
            if (grupo_rubro && grupo_rubro !== '' && grupo_rubro !== 'undefined') {
                if (grupoRubroIds.length > 0) summaryQuery = summaryQuery.in('grupo_rubro_id', grupoRubroIds);
                else summaryQuery = summaryQuery.eq('grupo_rubro_id', -1);
            }
            if (rubro && rubro !== '' && rubro !== 'undefined') {
                if (rubroIds.length > 0) summaryQuery = summaryQuery.in('rubro_id', rubroIds);
                else summaryQuery = summaryQuery.eq('rubro_id', -1);
            }
            if (sub_rubro && sub_rubro !== '' && sub_rubro !== 'undefined') {
                if (budgetIdsFromTipo.length > 0) summaryQuery = summaryQuery.in('id', budgetIdsFromTipo);
                else summaryQuery = summaryQuery.eq('id', -1);
            }

            const { data: allMatching } = await summaryQuery;

            let totalAprobado = 0;
            let totalBorrador = 0;
            let totalEjecutado = 0;
            let totalNoEjecutado = 0;
            let totalPresupuesto = 0;
            const rubrosIds = new Set<number>();

            if (allMatching && allMatching.length > 0) {
                allMatching.forEach((p: any) => {
                    rubrosIds.add(p.rubro_id);
                    if (p.presupuesto_items) {
                        p.presupuesto_items.forEach((item: any) => {
                            const total = item.valor_total || 0;
                            totalPresupuesto += total;

                            // Aprobado vs Borrador
                            if (item.estado === 'APROBADO') totalAprobado += total;
                            else totalBorrador += total;

                            // Ejecutado vs No Ejecutado
                            if (item.ejecutado === 'SI') totalEjecutado += total;
                            else totalNoEjecutado += total;
                        });
                    }
                });
            }

            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limitNum)
                },
                summary: {
                    totalAprobado,
                    totalBorrador,
                    totalEjecutado,
                    totalNoEjecutado,
                    totalPresupuesto,
                    rubrosUtilizados: rubrosIds.size,
                    anioVigencia: anio || new Date().getFullYear()
                }
            });
        } catch (error) {
            console.error('❌ Error fatal en getAll presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener presupuesto por ID con items
    async getById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const dbClient = req.supabase || supabase;

            // Obtener cabecera con relaciones completas (igual que getAll + rubro_padre_id)
            const { data: presupuesto, error: presupuestoError } = await dbClient
                .from('presupuestos')
                .select(`
                    *,
                    vehiculo:control_flota(
                        id, 
                        placa_id,
                        clase_vehiculo,
                        areas_placas(placa)
                    ),
                    area:areas_operacion(id, nombre),
                    grupo:maestro_rubros!grupo_rubro_id(id, codigo, nombre, rubro_padre_id),
                    rubro:maestro_rubros!rubro_id(id, codigo, nombre),
                    personal:Personal!presupuestos_empleado_id_fkey(id, tipo),
                    empresas(id, empresa)
                `)
                .eq('id', id)
                .single();

            if (presupuestoError) {
                console.error('Error fetching presupuesto detail:', presupuestoError);
                res.status(404).json({ error: 'Presupuesto no encontrado' });
                return;
            }

            // Obtener items
            const { data: items, error: itemsError } = await dbClient
                .from('presupuesto_items')
                .select('*, tipo:tipos_presupuesto(id, nombre), concepto:conceptos_presupuesto(id, nombre, unidad)')
                .eq('presupuesto_id', id)
                .order('id');

            if (itemsError) {
                res.status(400).json({ error: itemsError.message });
                return;
            }

            res.json({
                ...presupuesto,
                items: items || []
            });
        } catch (error) {
            console.error('Error en getById presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Crear presupuesto con items
    async create(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { items, ...presupuestoData } = req.body as Presupuesto & { items?: PresupuestoItem[] };

            // Crear cabecera
            const { data: presupuesto, error: presupuestoError } = await dbClient
                .from('presupuestos')
                .insert({
                    empresa_id: presupuestoData.empresa_id,
                    vehiculo_id: presupuestoData.vehiculo_id || null,
                    area_operacion_id: presupuestoData.area_operacion_id,
                    grupo_rubro_id: presupuestoData.grupo_rubro_id,
                    rubro_id: presupuestoData.rubro_id,
                    anio: presupuestoData.anio,
                    estado: presupuestoData.estado || 'BORRADOR',
                    empleado_id: presupuestoData.empleado_id || null
                })
                .select()
                .single();

            if (presupuestoError) {
                res.status(400).json({ error: presupuestoError.message });
                return;
            }

            // Crear items si existen
            if (items && items.length > 0) {
                const itemsToInsert = items.map(item => ({
                    presupuesto_id: presupuesto.id,
                    tipo_presupuesto_id: item.tipo_presupuesto_id,
                    concepto_presupuesto_id: item.concepto_presupuesto_id,
                    frecuencia_mes: item.frecuencia_mes,
                    meses_aplicables: item.meses_aplicables,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_unitario * item.frecuencia_mes * item.meses_aplicables.length,
                    nota: item.nota
                }));

                const { error: itemsError } = await dbClient
                    .from('presupuesto_items')
                    .insert(itemsToInsert);

                if (itemsError) {
                    // Rollback: eliminar presupuesto creado
                    await dbClient.from('presupuestos').delete().eq('id', presupuesto.id);
                    res.status(400).json({ error: itemsError.message });
                    return;
                }
            }

            res.status(201).json(presupuesto);
        } catch (error) {
            console.error('Error en create presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Actualizar presupuesto
    async update(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const { items, ...updateData } = req.body;

            const { data, error } = await (req.supabase || supabase)
                .from('presupuestos')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en update presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Eliminar presupuesto
    async delete(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;

            // Primero eliminar items
            await (req.supabase || supabase).from('presupuesto_items').delete().eq('presupuesto_id', id);

            // Luego eliminar cabecera
            const { error } = await (req.supabase || supabase)
                .from('presupuestos')
                .delete()
                .eq('id', id);

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(204).send();
        } catch (error) {
            console.error('Error en delete presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // ==================== ITEMS ====================

    // Agregar item a presupuesto
    async addItem(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const itemData = req.body as PresupuestoItem;

            const valor_total = itemData.valor_unitario * itemData.frecuencia_mes * itemData.meses_aplicables.length;

            const { data, error } = await (req.supabase || supabase)
                .from('presupuesto_items')
                .insert({
                    presupuesto_id: parseInt(id),
                    tipo_presupuesto_id: itemData.tipo_presupuesto_id,
                    concepto_presupuesto_id: itemData.concepto_presupuesto_id,
                    frecuencia_mes: itemData.frecuencia_mes,
                    meses_aplicables: itemData.meses_aplicables,
                    valor_unitario: itemData.valor_unitario,
                    valor_total,
                    nota: itemData.nota
                })
                .select()
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(201).json(data);
        } catch (error) {
            console.error('Error en addItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Actualizar item
    async updateItem(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { itemId } = req.params;
            const itemData = req.body as Partial<PresupuestoItem>;

            // Recalcular total si hay cambios en valores
            let updateData: any = { ...itemData };
            if (itemData.valor_unitario !== undefined || itemData.frecuencia_mes !== undefined || itemData.meses_aplicables !== undefined) {
                // Obtener item actual para valores faltantes
                const { data: current } = await (req.supabase || supabase)
                    .from('presupuesto_items')
                    .select('*')
                    .eq('id', itemId)
                    .single();

                if (current) {
                    const valor_unitario = itemData.valor_unitario ?? current.valor_unitario;
                    const frecuencia_mes = itemData.frecuencia_mes ?? current.frecuencia_mes;
                    const meses_aplicables = itemData.meses_aplicables ?? current.meses_aplicables;
                    updateData.valor_total = valor_unitario * frecuencia_mes * meses_aplicables.length;
                }
            }

            const { data, error } = await (req.supabase || supabase)
                .from('presupuesto_items')
                .update(updateData)
                .eq('id', itemId)
                .select()
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en updateItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Eliminar item
    async deleteItem(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { itemId } = req.params;

            const { error } = await (req.supabase || supabase)
                .from('presupuesto_items')
                .delete()
                .eq('id', itemId);

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.status(204).send();
        } catch (error) {
            console.error('Error en deleteItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener opciones de filtro
    async getFilterOptions(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            // Años disponibles
            const { data: aniosData } = await dbClient
                .from('presupuestos')
                .select('anio')
                .order('anio', { ascending: false });

            const anios = [...new Set(aniosData?.map(p => p.anio))];

            // Áreas - fetch with error handling
            const { data: areasData, error: areasError } = await dbClient
                .from('areas_operacion')
                .select('id, nombre')
                .order('nombre');

            if (areasError) {
                console.error('Error fetching areas:', areasError);
            }
            console.log('Areas fetched:', areasData?.length || 0, 'records');

            // Empresas
            const { data: empresasData } = await dbClient
                .from('empresas')
                .select('id, empresa')
                .order('empresa');

            // Vehículos con su placa real y área asociada
            // Use select(*) to work around accented column name issues
            const { data: vehiculosData, error: vehiculosError } = await dbClient
                .from('control_flota')
                .select('*, areas_placas(id, placa)')
                .order('placa_id');

            if (vehiculosError) {
                console.error('Error fetching vehiculos:', vehiculosError);
            }

            // Formatear vehículos para el frontend
            // Use bracket notation for accented column operación_id
            const vehiculos = (vehiculosData || []).map((v: any) => ({
                id: v.id,
                placa_id: v.placa_id,
                operación_id: v.operación_id,
                area_id: v.operación_id,
                clase_vehiculo: v.clase_vehiculo,
                placa: v.areas_placas?.placa
            }));

            // Grupos y Rubros: fetch what's actually in use in the budgets table
            const { data: usedCategories } = await dbClient
                .from('presupuestos')
                .select('grupo_rubro_id, rubro_id');
            
            const usedGroupIds = [...new Set(usedCategories?.map(p => p.grupo_rubro_id).filter(id => id !== null))];
            const usedRubroIds = [...new Set(usedCategories?.map(p => p.rubro_id).filter(id => id !== null))];

            const { data: groupsRaw } = await dbClient
                .from('maestro_rubros')
                .select('id, nombre')
                .in('id', usedGroupIds)
                .order('nombre');

            const { data: rubrosRaw } = await dbClient
                .from('maestro_rubros')
                .select('id, nombre')
                .in('id', usedRubroIds)
                .order('nombre');

            // Help keep names unique in dropdown to avoid user confusion
            const uniqueNamedFilter = (arr: any[], keyName: string = 'nombre') => {
                const map = new Map();
                arr.forEach(item => {
                    const val = item[keyName];
                    if (val && !map.has(val)) map.set(val, item);
                });
                return Array.from(map.values());
            };

            // Personal (tipos de empleado)
            const { data: personalData } = await dbClient
                .from('Personal')
                .select('id, tipo')
                .order('tipo');

            // Tipos de presupuesto (Item level names like "LLANTAS NUEVAS")
            const { data: tiposPresupuestoData } = await dbClient
                .from('tipos_presupuesto')
                .select('id, nombre')
                .eq('activo', true)
                .order('nombre');

            const finalAreas = uniqueNamedFilter(areasData || [], 'nombre');
            const finalEmpresas = uniqueNamedFilter(empresasData || [], 'empresa');
            const finalGrupos = uniqueNamedFilter(groupsRaw || [], 'nombre');
            const finalSubRubros = uniqueNamedFilter(rubrosRaw || [], 'nombre');
            const finalTipos = uniqueNamedFilter(tiposPresupuestoData || [], 'nombre');

            res.json({
                anios,
                areas: finalAreas,
                empresas: finalEmpresas,
                vehiculos,
                grupos_rubro: finalGrupos,
                sub_rubros: finalSubRubros,
                tipos_presupuesto: finalTipos,
                personal: personalData || []
            });
        } catch (error) {
            console.error('Error en getFilterOptions:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
