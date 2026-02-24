"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presupuestosController = void 0;
const supabase_1 = require("../config/supabase");
exports.presupuestosController = {
    // ==================== CATÁLOGOS ====================
    // Obtener maestro de rubros
    async getRubros(req, res) {
        try {
            const tipo = req.query.tipo;
            const nivel = req.query.nivel;
            const padre_id = req.query.padre_id;
            let query = supabase_1.supabase
                .from('maestro_rubros')
                .select('*')
                .eq('activo', true)
                .order('codigo');
            if (tipo)
                query = query.eq('tipo', tipo);
            if (nivel)
                query = query.eq('nivel', parseInt(nivel));
            if (padre_id)
                query = query.eq('rubro_padre_id', parseInt(padre_id));
            const { data, error } = await query;
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error en getRubros:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Obtener tipos de presupuesto
    async getTipos(req, res) {
        try {
            const { padre_id } = req.query;
            let query = supabase_1.supabase
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
        }
        catch (error) {
            console.error('Error en getTipos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Obtener conceptos por tipo
    async getConceptos(req, res) {
        try {
            const tipo_id = req.query.tipo_id;
            let query = supabase_1.supabase
                .from('conceptos_presupuesto')
                .select('*')
                .eq('activo', true)
                .order('nombre');
            if (tipo_id)
                query = query.eq('tipo_presupuesto_id', parseInt(tipo_id));
            const { data, error } = await query;
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error en getConceptos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Crear nuevo tipo de presupuesto (Solo ADMIN)
    async createTipo(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
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
        }
        catch (error) {
            console.error('Error en createTipo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Crear nuevo concepto de presupuesto (Solo ADMIN)
    async createConcepto(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
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
        }
        catch (error) {
            console.error('Error en createConcepto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // ==================== PRESUPUESTOS ====================
    // Listar presupuestos con paginación
    async getAll(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
            const { page = 1, limit = 20, empresa, vehiculo_id, placa, area_operacion, anio, grupo_rubro, sub_rubro, sort_by = 'id', sort_order = 'desc' } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;
            // Resolve area_operacion name to ID if provided
            let areaId = null;
            if (area_operacion && area_operacion !== 'undefined' && area_operacion !== '') {
                const { data: areaData } = await dbClient
                    .from('areas_operacion')
                    .select('id')
                    .eq('nombre', area_operacion)
                    .maybeSingle();
                areaId = areaData?.id || null;
            }
            // Resolve empresa name to ID if provided
            let empresaId = null;
            if (empresa && empresa !== 'undefined' && empresa !== '') {
                const { data: empresaData } = await dbClient
                    .from('empresas')
                    .select('id')
                    .eq('empresa', empresa)
                    .maybeSingle();
                empresaId = empresaData?.id || null;
            }
            // Resolve grupo_rubro name to ID if provided
            let grupoRubroId = null;
            if (grupo_rubro && grupo_rubro !== 'undefined' && grupo_rubro !== '') {
                const { data: grupoData } = await dbClient
                    .from('maestro_rubros')
                    .select('id')
                    .eq('nombre', grupo_rubro)
                    .is('rubro_padre_id', null)
                    .maybeSingle();
                grupoRubroId = grupoData?.id || null;
            }
            // Resolve sub_rubro name to ID if provided
            let subRubroId = null;
            if (sub_rubro && sub_rubro !== 'undefined' && sub_rubro !== '') {
                const { data: rubroData } = await dbClient
                    .from('maestro_rubros')
                    .select('id')
                    .eq('nombre', sub_rubro)
                    .not('rubro_padre_id', 'is', null)
                    .maybeSingle();
                subRubroId = rubroData?.id || null;
            }
            // Resolve placa to vehiculo ID
            let vehiculoIdFromPlaca = null;
            if (placa && placa !== 'undefined' && placa !== '') {
                // Find placa_id first
                const { data: placaData } = await dbClient
                    .from('areas_placas')
                    .select('id')
                    .eq('placa', placa)
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
                    grupo:maestro_rubros!presupuestos_grupo_rubro_id_fkey(id, codigo, nombre),
                    rubro:maestro_rubros!presupuestos_rubro_id_fkey(id, codigo, nombre),
                    personal:Personal!presupuestos_empleado_id_fkey(id, tipo)
                `, { count: 'exact' });
            // Filtros directos por ID
            if (vehiculo_id)
                query = query.eq('vehiculo_id', Number(vehiculo_id));
            if (anio && anio !== 'undefined' && anio !== '')
                query = query.eq('anio', Number(anio));
            // Filtros por ID resuelto
            if (areaId !== null) {
                query = query.eq('area_operacion_id', areaId);
            }
            if (empresaId !== null) {
                query = query.eq('empresa_id', empresaId);
            }
            if (grupoRubroId !== null) {
                query = query.eq('grupo_rubro_id', grupoRubroId);
            }
            if (subRubroId !== null) {
                query = query.eq('rubro_id', subRubroId);
            }
            if (vehiculoIdFromPlaca !== null) {
                query = query.eq('vehiculo_id', vehiculoIdFromPlaca);
            }
            const ascending = sort_order === 'asc';
            query = query.order(sort_by, { ascending });
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
                .select('id, estado, rubro_id');
            if (vehiculo_id)
                summaryQuery = summaryQuery.eq('vehiculo_id', Number(vehiculo_id));
            if (vehiculoIdFromPlaca !== null)
                summaryQuery = summaryQuery.eq('vehiculo_id', vehiculoIdFromPlaca);
            if (anio && anio !== 'undefined' && anio !== '')
                summaryQuery = summaryQuery.eq('anio', Number(anio));
            const { data: allMatching } = await summaryQuery;
            let totalAprobado = 0;
            let totalBorrador = 0;
            const rubrosIds = new Set();
            if (allMatching && allMatching.length > 0) {
                const budgetsIds = allMatching.map(p => p.id);
                allMatching.forEach(p => rubrosIds.add(p.rubro_id));
                // Obtener los totales desde presupuesto_items para estos IDs
                const { data: itemTotals } = await dbClient
                    .from('presupuesto_items')
                    .select('presupuesto_id, valor_total')
                    .in('presupuesto_id', budgetsIds);
                if (itemTotals) {
                    const budgetToTotalMap = itemTotals.reduce((acc, item) => {
                        acc[item.presupuesto_id] = (acc[item.presupuesto_id] || 0) + item.valor_total;
                        return acc;
                    }, {});
                    allMatching.forEach(p => {
                        const total = budgetToTotalMap[p.id] || 0;
                        if (p.estado === 'APROBADO')
                            totalAprobado += total;
                        else
                            totalBorrador += total;
                    });
                }
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
                    rubrosUtilizados: rubrosIds.size,
                    anioVigencia: anio || new Date().getFullYear()
                }
            });
        }
        catch (error) {
            console.error('❌ Error fatal en getAll presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Obtener presupuesto por ID con items
    async getById(req, res) {
        try {
            const { id } = req.params;
            const dbClient = req.supabase || supabase_1.supabase;
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
                    personal:Personal!presupuestos_empleado_id_fkey(id, tipo)
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
        }
        catch (error) {
            console.error('Error en getById presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Crear presupuesto con items
    async create(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
            const { items, ...presupuestoData } = req.body;
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
                    valor_total: item.valor_unitario * item.frecuencia_mes * item.meses_aplicables.length
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
        }
        catch (error) {
            console.error('Error en create presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Actualizar presupuesto
    async update(req, res) {
        try {
            const { id } = req.params;
            const { items, ...updateData } = req.body;
            const { data, error } = await supabase_1.supabase
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
        }
        catch (error) {
            console.error('Error en update presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Eliminar presupuesto
    async delete(req, res) {
        try {
            const { id } = req.params;
            // Primero eliminar items
            await supabase_1.supabase.from('presupuesto_items').delete().eq('presupuesto_id', id);
            // Luego eliminar cabecera
            const { error } = await supabase_1.supabase
                .from('presupuestos')
                .delete()
                .eq('id', id);
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.status(204).send();
        }
        catch (error) {
            console.error('Error en delete presupuesto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // ==================== ITEMS ====================
    // Agregar item a presupuesto
    async addItem(req, res) {
        try {
            const { id } = req.params;
            const itemData = req.body;
            const valor_total = itemData.valor_unitario * itemData.frecuencia_mes * itemData.meses_aplicables.length;
            const { data, error } = await supabase_1.supabase
                .from('presupuesto_items')
                .insert({
                presupuesto_id: parseInt(id),
                tipo_presupuesto_id: itemData.tipo_presupuesto_id,
                concepto_presupuesto_id: itemData.concepto_presupuesto_id,
                frecuencia_mes: itemData.frecuencia_mes,
                meses_aplicables: itemData.meses_aplicables,
                valor_unitario: itemData.valor_unitario,
                valor_total
            })
                .select()
                .single();
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.status(201).json(data);
        }
        catch (error) {
            console.error('Error en addItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Actualizar item
    async updateItem(req, res) {
        try {
            const { itemId } = req.params;
            const itemData = req.body;
            // Recalcular total si hay cambios en valores
            let updateData = { ...itemData };
            if (itemData.valor_unitario !== undefined || itemData.frecuencia_mes !== undefined || itemData.meses_aplicables !== undefined) {
                // Obtener item actual para valores faltantes
                const { data: current } = await supabase_1.supabase
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
            const { data, error } = await supabase_1.supabase
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
        }
        catch (error) {
            console.error('Error en updateItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Eliminar item
    async deleteItem(req, res) {
        try {
            const { itemId } = req.params;
            const { error } = await supabase_1.supabase
                .from('presupuesto_items')
                .delete()
                .eq('id', itemId);
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.status(204).send();
        }
        catch (error) {
            console.error('Error en deleteItem:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Obtener opciones de filtro
    async getFilterOptions(req, res) {
        try {
            const dbClient = req.supabase || supabase_1.supabase;
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
            const vehiculos = (vehiculosData || []).map((v) => ({
                id: v.id,
                placa_id: v.placa_id,
                operación_id: v.operación_id,
                area_id: v.operación_id,
                clase_vehiculo: v.clase_vehiculo,
                placa: v.areas_placas?.placa
            }));
            // Grupos de rubro (rubros sin padre = nivel superior)
            const { data: gruposRubroData } = await dbClient
                .from('maestro_rubros')
                .select('id, nombre')
                .is('rubro_padre_id', null)
                .eq('activo', true)
                .order('nombre');
            // Sub rubros (rubros con padre = nivel inferior)
            const { data: subRubrosData } = await dbClient
                .from('maestro_rubros')
                .select('id, nombre')
                .not('rubro_padre_id', 'is', null)
                .eq('activo', true)
                .order('nombre');
            // Personal (tipos de empleado)
            const { data: personalData } = await dbClient
                .from('Personal')
                .select('id, tipo')
                .order('tipo');
            res.json({
                anios,
                areas: areasData || [],
                empresas: empresasData || [],
                vehiculos,
                grupos_rubro: gruposRubroData || [],
                sub_rubros: subRubrosData || [],
                personal: personalData || []
            });
        }
        catch (error) {
            console.error('Error en getFilterOptions:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
