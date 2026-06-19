import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest, Presupuesto, PresupuestoItem } from '../types';
import { PagoModel } from '../models/pagos.model';

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

    // Actualizar tipo de presupuesto (Solo ADMIN)
    async updateTipo(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { id } = req.params;
            const { nombre, descripcion } = req.body;

            if (!nombre) {
                res.status(400).json({ error: 'Nombre es requerido' });
                return;
            }

            const { data, error } = await dbClient
                .from('tipos_presupuesto')
                .update({
                    nombre,
                    descripcion
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error de Supabase en updateTipo:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en updateTipo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Actualizar concepto de presupuesto (Solo ADMIN)
    async updateConcepto(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { id } = req.params;
            const { nombre, unidad } = req.body;

            if (!nombre) {
                res.status(400).json({ error: 'Nombre es requerido' });
                return;
            }

            const { data, error } = await dbClient
                .from('conceptos_presupuesto')
                .update({
                    nombre,
                    unidad
                })
                .eq('id', id)
                .select()
                .single();

            if (error) {
                console.error('Error de Supabase en updateConcepto:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en updateConcepto:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Eliminar tipo de presupuesto (Solo ADMIN)
    async deleteTipo(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { id } = req.params;

            const { error } = await dbClient
                .from('tipos_presupuesto')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error de Supabase en deleteTipo:', error);
                if (error.code === '23503') {
                    res.status(400).json({ error: 'No se puede eliminar este Tipo porque está siendo utilizado en ítems de presupuesto' });
                    return;
                }
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: 'Tipo eliminado correctamente' });
        } catch (error) {
            console.error('Error en deleteTipo:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Eliminar concepto de presupuesto (Solo ADMIN)
    async deleteConcepto(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;

            if (req.user?.rol !== 'ADMIN') {
                res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
                return;
            }

            const { id } = req.params;

            const { error } = await dbClient
                .from('conceptos_presupuesto')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error de Supabase en deleteConcepto:', error);
                if (error.code === '23503') {
                    res.status(400).json({ error: 'No se puede eliminar este Concepto porque está siendo utilizado en ítems de presupuesto' });
                    return;
                }
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: 'Concepto eliminado correctamente' });
        } catch (error) {
            console.error('Error en deleteConcepto:', error);
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
                mes,
                sort_by = 'id',
                sort_order = 'desc'
            } = req.query;

            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;

            // Resolve area_operacion names to IDs
            let areaIds: number[] = [];
            if (area_operacion && area_operacion !== 'undefined' && area_operacion !== '') {
                const names = String(area_operacion).split(',').map(s => s.trim()).filter(Boolean);
                if (names.length > 0) {
                    const { data: areaData, error: areaError } = await dbClient
                        .from('areas_operacion')
                        .select('id')
                        .in('nombre', names);
                    
                    if (areaError) console.error('Error resolving area_operacion:', areaError);
                    areaIds = areaData?.map(a => a.id) || [];
                }
                console.log(`[Presupuestos Filter] Area: "${area_operacion}" -> ${areaIds}`);
            }

            // Resolve empresa names to IDs
            let empresaIds: number[] = [];
            if (empresa && empresa !== 'undefined' && empresa !== '') {
                const names = String(empresa).split(',').map(s => s.trim()).filter(Boolean);
                if (names.length > 0) {
                    const { data: empresaData, error: empresaError } = await dbClient
                        .from('empresas')
                        .select('id')
                        .in('empresa', names);
                    
                    if (empresaError) console.error('Error resolving empresa:', empresaError);
                    empresaIds = empresaData?.map(e => e.id) || [];
                }
                console.log(`[Presupuestos Filter] Empresa: "${empresa}" -> ${empresaIds}`);
            }

            // Resolve grupo_rubro names to IDs
            let grupoRubroIds: number[] = [];
            if (grupo_rubro && grupo_rubro !== 'undefined' && grupo_rubro !== '') {
                const names = String(grupo_rubro).split(',').map(s => s.trim()).filter(Boolean);
                if (names.length > 0) {
                    const { data: grupoData, error: grupoError } = await dbClient
                        .from('maestro_rubros')
                        .select('id')
                        .in('nombre', names);
                    
                    if (grupoError) console.error('Error resolving grupo_rubro:', grupoError);
                    grupoRubroIds = grupoData?.map(g => g.id) || [];
                }
                console.log(`[Presupuestos Filter] Grupo (L1): "${grupo_rubro}" -> ${grupoRubroIds}`);
            }

            // Resolve rubro names to IDs
            let rubroIds: number[] = [];
            if (rubro && rubro !== 'undefined' && rubro !== '') {
                const names = String(rubro).split(',').map(s => s.trim()).filter(Boolean);
                if (names.length > 0) {
                    const { data: rData, error: rError } = await dbClient
                        .from('maestro_rubros')
                        .select('id')
                        .in('nombre', names);
                    
                    if (rError) console.error('Error resolving rubro:', rError);
                    rubroIds = rData?.map(r => r.id) || [];
                }
                console.log(`[Presupuestos Filter] Rubro (L2): "${rubro}" -> ${rubroIds}`);
            }

            // Resolve sub_rubro names STRICTLY to item types (Level 3) to avoid collision with Rubro (Level 2)
            let budgetIdsFromTipo: number[] = [];
            if (sub_rubro && sub_rubro !== 'undefined' && sub_rubro !== '') {
                const subRubroNames = String(sub_rubro).split(',').map(s => s.trim()).filter(Boolean);

                if (subRubroNames.length > 0) {
                    // Resolve all matches from tipos_presupuesto (the item-level definition)
                    const { data: tipoData, error: tipoError } = await dbClient
                        .from('tipos_presupuesto')
                        .select('id')
                        .in('nombre', subRubroNames);

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
                            budgetIdsFromTipo = [...new Set((itemData as any[]).map((d: any) => Number(d.presupuesto_id)))];
                        }
                    }
                }

                console.log(`[Presupuestos Filter] Sub Rubro (L3): "${sub_rubro}" -> BudgetIDsWithTipoCount: ${budgetIdsFromTipo.length}`);
            }

            // Resolve placa to vehiculo ID
            let vehiculoIdsFromPlaca: number[] = [];
            if (placa && placa !== 'undefined' && placa !== '') {
                const placas = String(placa).split(',').map(s => s.trim()).filter(Boolean);
                if (placas.length > 0) {
                    // Find placa_ids first
                    const { data: placaData } = await dbClient
                        .from('areas_placas')
                        .select('id')
                        .in('placa', placas);

                    if (placaData && placaData.length > 0) {
                        const placaIds = placaData.map(p => p.id);
                        // Find vehiculo_ids from control_flota using placa_ids
                        const { data: vData } = await dbClient
                            .from('control_flota')
                            .select('id')
                            .in('placa_id', placaIds);

                        if (vData && vData.length > 0) {
                            vehiculoIdsFromPlaca = vData.map(d => d.id);
                        }
                    }
                }
                console.log(`[Presupuestos Filter] Placa: "${placa}" -> VehiculoIDs: ${vehiculoIdsFromPlaca}`);
            }

            // Resolve mes filter (abbreviated month to number 1-12)
            let budgetIdsFromMonth: number[] = [];
            let monthNums: number[] = [];
            if (mes && mes !== 'undefined' && mes !== '') {
                const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                const mesList = String(mes).toLowerCase().trim().split(',').map(s => s.trim()).filter(Boolean);
                
                mesList.forEach(m => {
                    const monthIndex = monthNames.indexOf(m);
                    if (monthIndex !== -1) {
                        monthNums.push(monthIndex + 1);
                    }
                });
                
                if (monthNums.length > 0) {
                    // Find all presupuesto_items where meses_aplicables overlaps with monthNums
                    const { data: itemData, error: itemError } = await dbClient
                        .from('presupuesto_items')
                        .select('presupuesto_id')
                        .overlaps('meses_aplicables', monthNums);
                        
                    if (itemError) {
                        console.error('Error finding budgets for month filter:', itemError);
                    } else if (itemData && itemData.length > 0) {
                        budgetIdsFromMonth = [...new Set((itemData as any[]).map((d: any) => Number(d.presupuesto_id)))];
                    }
                }
                
                console.log(`[Presupuestos Filter] Mes: "${mes}" (Indices: ${monthNums}) -> BudgetIDsWithMonthCount: ${budgetIdsFromMonth.length}`);
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
                    presupuesto_items(id, valor_total, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes, nota, tipo:tipos_presupuesto(id, nombre), concepto:conceptos_presupuesto(id, nombre, unidad))
                `, { count: 'exact' });

            // Filtros directos por ID
            if (vehiculo_id) query = query.eq('vehiculo_id', Number(vehiculo_id));
            if (anio && anio !== 'undefined' && anio !== '') query = query.eq('anio', Number(anio));

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
            if (mes && mes !== '' && mes !== 'undefined') {
                if (budgetIdsFromMonth.length > 0) {
                    query = query.in('id', budgetIdsFromMonth);
                } else {
                    query = query.eq('id', -1);
                }
            }
            if (vehiculoIdsFromPlaca.length > 0) {
                query = query.in('vehiculo_id', vehiculoIdsFromPlaca);
            } else if (placa && placa !== 'undefined' && placa !== '') {
                query = query.eq('vehiculo_id', -1);
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
            let summaryQuery = dbClient
                .from('presupuestos')
                .select('id, rubro_id, presupuesto_items(estado, valor_total, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes)');

            if (vehiculo_id) summaryQuery = summaryQuery.eq('vehiculo_id', Number(vehiculo_id));
            if (vehiculoIdsFromPlaca.length > 0) {
                summaryQuery = summaryQuery.in('vehiculo_id', vehiculoIdsFromPlaca);
            } else if (placa && placa !== 'undefined' && placa !== '') {
                summaryQuery = summaryQuery.eq('vehiculo_id', -1);
            }
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
            if (mes && mes !== '' && mes !== 'undefined') {
                if (budgetIdsFromMonth.length > 0) summaryQuery = summaryQuery.in('id', budgetIdsFromMonth);
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
                            let total = item.valor_total || 0;

                            if (monthNums.length > 0) {
                                const applicableSelectedMonths = (item.meses_aplicables || []).filter((m: number) => monthNums.includes(m));
                                if (applicableSelectedMonths.length === 0) return;
                                total = (item.valor_unitario || 0) * (item.frecuencia_mes || 1) * applicableSelectedMonths.length;
                            }

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

            // --- CÁLCULO DE TOTAL EJECUTADO REAL DESDE MONGODB ---
            let totalEjecutadoReal = 0;
            try {
                // Obtener validacionGrupos dinámica basada en los presupuestos del año actual
                const yearNum = anio && anio !== 'undefined' && anio !== '' ? Number(anio) : new Date().getFullYear();
                
                const { data: presupuestosForValidation } = await dbClient
                    .from('presupuestos')
                    .select('grupo:maestro_rubros!presupuestos_grupo_rubro_id_fkey(nombre), rubro:maestro_rubros!presupuestos_rubro_id_fkey(nombre)')
                    .eq('anio', yearNum);

                let validacionGrupos: any = { _id: null }; // Fallback para no coincidir nada
                if (presupuestosForValidation && presupuestosForValidation.length > 0) {
                    const combos = new Set<string>();
                    const orConditions: any[] = [];
                    presupuestosForValidation.forEach((p: any) => {
                        const g = (p.grupo?.nombre || '').trim();
                        const r = (p.rubro?.nombre || '').trim();
                        if (!g) return;

                        const key = `${g}|${r}`;
                        if (!combos.has(key)) {
                            combos.add(key);
                            const cond: any = { 
                                $or: [
                                    { grupoRubro: new RegExp(`^${g}$`, 'i') },
                                    { nombreGrupoRubro: new RegExp(`^${g}$`, 'i') }
                                ]
                            };
                            if (r) {
                                cond.$or.forEach((orCond: any) => {
                                    orCond.rubro = new RegExp(`^${r}$`, 'i');
                                });
                            }
                            orConditions.push(cond);
                        }
                    });
                    if (orConditions.length > 0) {
                        validacionGrupos = { $or: orConditions };
                    }
                }

                const mongoQuery: any = {
                    activo: true,
                    ...validacionGrupos
                };

                const applyMongoFilter = (field: string, val: any) => {
                    if (!val || val === 'undefined') return;
                    const arr = String(val).split(',').map(s => s.trim()).filter(Boolean);
                    if (arr.length > 0) {
                        mongoQuery[field] = { $in: arr.map(a => new RegExp(a, 'i')) };
                    }
                };

                applyMongoFilter('placa', placa);
                applyMongoFilter('areaOperacion', area_operacion);
                applyMongoFilter('empresa', empresa);

                if (grupo_rubro && grupo_rubro !== 'undefined') {
                    const arr = String(grupo_rubro).split(',').map(s => s.trim()).filter(Boolean);
                    if (arr.length > 0) {
                        const inRegExp = { $in: arr.map(a => new RegExp(a, 'i')) };
                        if (mongoQuery.$and) {
                            mongoQuery.$and.push({ $or: [{ grupoRubro: inRegExp }, { nombreGrupoRubro: inRegExp }] });
                        } else {
                            mongoQuery.$and = [{ $or: [{ grupoRubro: inRegExp }, { nombreGrupoRubro: inRegExp }] }];
                        }
                    }
                }
                applyMongoFilter('rubro', rubro);
                applyMongoFilter('subRubro', sub_rubro);

                // Filtrado por fecha (Año y Meses) - Usando fechaPago con fallback a fecha
                const getDateQuery = (start: Date, end: Date) => {
                    const dateRange = { $gte: start, $lte: end };
                    return {
                        $or: [
                            { fechaPago: dateRange },
                            {
                                $and: [
                                    { $or: [{ fechaPago: { $exists: false } }, { fechaPago: null }] },
                                    { fecha: dateRange }
                                ]
                            }
                        ]
                    };
                };

                if (monthNums.length > 0) {
                    const ranges = monthNums.map(m => {
                        const start = new Date(Date.UTC(yearNum, m - 1, 1, 0, 0, 0, 0));
                        const end = new Date(Date.UTC(yearNum, m, 0, 23, 59, 59, 999));
                        return getDateQuery(start, end);
                    });
                    if (mongoQuery.$and) {
                        mongoQuery.$and.push({ $or: ranges });
                    } else {
                        mongoQuery.$and = [{ $or: ranges }];
                    }
                } else {
                    const start = new Date(Date.UTC(yearNum, 0, 1, 0, 0, 0, 0));
                    const end = new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59, 999));
                    const baseQuery = getDateQuery(start, end);
                    if (mongoQuery.$and) {
                        mongoQuery.$and.push({ $or: baseQuery.$or });
                    } else {
                        mongoQuery.$and = [{ $or: baseQuery.$or }];
                    }
                }

                const aggregateResult = await PagoModel.aggregate([
                    { $match: mongoQuery },
                    {
                        $group: {
                            _id: null,
                            totalOperacion: { $sum: '$valorOperacion' }
                        }
                    }
                ]);

                if (aggregateResult && aggregateResult.length > 0) {
                    totalEjecutadoReal = aggregateResult[0].totalOperacion || 0;
                }
            } catch (mongoError) {
                console.error('❌ Error al calcular totalEjecutadoReal desde MongoDB:', mongoError);
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
                    totalEjecutadoReal,
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
            const { items, ...updateData } = req.body as Presupuesto & { items?: PresupuestoItem[] };
            const dbClient = req.supabase || supabase;

            const { data, error } = await dbClient
                .from('presupuestos')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            if (items) {
                const currentItemIds = items.map(i => i.id).filter(Boolean);
                
                if (currentItemIds.length > 0) {
                    await dbClient
                        .from('presupuesto_items')
                        .delete()
                        .eq('presupuesto_id', id)
                        .not('id', 'in', `(${currentItemIds.join(',')})`);
                } else {
                    await dbClient
                        .from('presupuesto_items')
                        .delete()
                        .eq('presupuesto_id', id);
                }

                const itemsToInsert = items.filter(i => !i.id).map(item => ({
                    presupuesto_id: Number(id),
                    tipo_presupuesto_id: item.tipo_presupuesto_id,
                    concepto_presupuesto_id: item.concepto_presupuesto_id,
                    frecuencia_mes: item.frecuencia_mes,
                    meses_aplicables: item.meses_aplicables,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_unitario * item.frecuencia_mes * item.meses_aplicables.length,
                    nota: item.nota,
                    ejecutado: item.ejecutado || 'NO',
                    estado: item.estado || 'BORRADOR'
                }));

                const itemsToUpdate = items.filter(i => i.id).map(item => ({
                    id: item.id,
                    presupuesto_id: Number(id),
                    tipo_presupuesto_id: item.tipo_presupuesto_id,
                    concepto_presupuesto_id: item.concepto_presupuesto_id,
                    frecuencia_mes: item.frecuencia_mes,
                    meses_aplicables: item.meses_aplicables,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_unitario * item.frecuencia_mes * item.meses_aplicables.length,
                    nota: item.nota,
                    ejecutado: item.ejecutado || 'NO',
                    estado: item.estado || 'BORRADOR'
                }));

                if (itemsToInsert.length > 0) {
                    await dbClient.from('presupuesto_items').insert(itemsToInsert);
                }
                
                if (itemsToUpdate.length > 0) {
                    await dbClient.from('presupuesto_items').upsert(itemsToUpdate);
                }
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

            // Vehículos con su placa real y área asociada, consultado desde la tabla vehiculo
            const { data: vehiculosData, error: vehiculosError } = await dbClient
                .from('vehiculo')
                .select(`
                    id,
                    placa_id,
                    operacion_id,
                    areas_placas ( id, placa ),
                    vehiculo_caracteristicas (
                        cat_clase_vehiculo ( nombre )
                    )
                `);

            if (vehiculosError) {
                console.error('Error fetching vehiculos from vehiculo table:', vehiculosError);
            }

            // Consultamos control_flota para obtener el ID correcto que la tabla presupuestos espera para guardar
            const { data: controlFlotaData, error: controlFlotaError } = await dbClient
                .from('control_flota')
                .select('id, placa_id');

            if (controlFlotaError) {
                console.error('Error fetching vehiculos from control_flota table:', controlFlotaError);
            }

            // Formatear vehículos para el frontend usando el control_flota.id correspondientes a la misma placa_id
            const vehiculos = (vehiculosData || []).map((v: any) => {
                const placaData = Array.isArray(v.areas_placas) ? v.areas_placas[0] : v.areas_placas;
                const chars = Array.isArray(v.vehiculo_caracteristicas) ? v.vehiculo_caracteristicas[0] : v.vehiculo_caracteristicas;
                const catClase = chars?.cat_clase_vehiculo;
                const clase_vehiculo = (Array.isArray(catClase) ? catClase[0] : catClase)?.nombre || '';

                // Buscamos la fila correspondiente en control_flota con el mismo placa_id para usar su ID real
                const matchFlota = (controlFlotaData || []).find((cf: any) => cf.placa_id === v.placa_id);
                const dbVehiculoId = matchFlota ? matchFlota.id : v.id;

                return {
                    id: dbVehiculoId,             // El ID de control_flota para que la base de datos lo guarde con la placa correcta
                    placa_id: v.placa_id,
                    operación_id: v.operacion_id, // Compatible con la interfaz frontend
                    area_id: v.operacion_id,      // Compatible con la interfaz frontend
                    clase_vehiculo: clase_vehiculo,
                    placa: placaData?.placa || ''
                };
            });

            // Ordenar alfabéticamente por placa para mejor UX
            vehiculos.sort((a, b) => a.placa.localeCompare(b.placa));

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
