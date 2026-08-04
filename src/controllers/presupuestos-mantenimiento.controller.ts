import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';
import { PagoModel } from '../models/pagos.model';

export const presupuestosMantenimientoController = {
    async getFilterOptions(req: AuthRequest, res: Response) {
        try {
            const dbClient = req.supabase || supabase;
            const [
                { data: vehiculos },
                { data: areas },
                { data: empresas },
                { data: grupos_rubro },
                { data: sub_rubros },
                { data: tipos_presupuesto },
                { data: conceptos }
            ] = await Promise.all([
                dbClient.from('vehiculo').select('id, clase_vehiculo, areas_placas!inner(placa)'),
                dbClient.from('areas_operacion').select('id, nombre').order('nombre'),
                dbClient.from('empresas').select('id, empresa').order('empresa'),
                dbClient.from('maestro_rubros').select('id, nombre, codigo').eq('nivel', 2).order('nombre'),
                dbClient.from('maestro_rubros').select('id, nombre, codigo').eq('nivel', 3).order('nombre'),
                dbClient.from('tipos_presupuesto').select('id, nombre').order('nombre'),
                dbClient.from('conceptos_presupuesto').select('id, nombre').order('nombre')
            ]);

            const currentYear = new Date().getFullYear();
            const anios = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

            // Map vehiculos to flatten placa
            const vehiculosMapped = vehiculos?.map((v: any) => ({
                id: v.id,
                clase_vehiculo: v.clase_vehiculo,
                placa: Array.isArray(v.areas_placas) ? v.areas_placas[0]?.placa : v.areas_placas?.placa
            })) || [];

            res.json({
                vehiculos: vehiculosMapped,
                areas: areas || [],
                empresas: empresas || [],
                grupos_rubro: grupos_rubro || [],
                sub_rubros: sub_rubros || [],
                tipos_presupuesto: tipos_presupuesto || [],
                conceptos: conceptos || [],
                anios
            });
        } catch (error) {
            console.error('Error getFilterOptions:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getReactiveFilterOptions(req: AuthRequest, res: Response) {
        try {
            const dbClient = req.supabase || supabase;
            const {
                empresa, vehiculo_id, placa, area_operacion, anio,
                grupo_rubro, rubro, sub_rubro, concepto, mes
            } = req.query;

            let query = dbClient
                .from('presupuesto_unificado')
                .select(`
                    vehiculo(*, areas_placas(*)),
                    areas_operacion(*),
                    empresas(*),
                    grupo:maestro_rubros!grupo_rubro_id(*),
                    rubro:maestro_rubros!rubro_id(*),
                    tipo:tipos_presupuesto(*),
                    concepto:conceptos_presupuesto(*)
                `);

            const isNum = (v: any) => v && v !== 'undefined' && v !== 'null' && !isNaN(Number(v));
            
            const getFilterIds = async (table: string, column: string, value: any, extraFilter?: {col: string, val: any}) => {
                if (!value || value === 'undefined' || value === 'null' || value === '') return null;
                if (isNum(value)) return [Number(value)];
                let q = dbClient.from(table).select('id').ilike(column, `%${String(value).trim()}%`);
                if (extraFilter) q = q.eq(extraFilter.col, extraFilter.val);
                const { data } = await q;
                return data && data.length > 0 ? data.map(d => d.id) : [-1];
            };

            const filterPlaca = placa || vehiculo_id;
            if (filterPlaca && filterPlaca !== 'undefined' && filterPlaca !== '' && filterPlaca !== 'null') {
                if (isNum(filterPlaca)) {
                    query = query.eq('vehiculo_id', Number(filterPlaca));
                } else {
                    const { data: placasData } = await dbClient.from('areas_placas').select('id').ilike('placa', `%${String(filterPlaca).trim()}%`);
                    const pIds = placasData?.map(p => p.id) || [];
                    if (pIds.length > 0) {
                        const { data: vehData } = await dbClient.from('vehiculo').select('id').in('placa_id', pIds);
                        const vIds = vehData?.map(v => v.id) || [-1];
                        query = query.in('vehiculo_id', vIds);
                    } else {
                        query = query.in('vehiculo_id', [-1]);
                    }
                }
            }

            const empIds = await getFilterIds('empresas', 'empresa', empresa);
            if (empIds) query = query.in('empresa_id', empIds);

            const areaIds = await getFilterIds('areas_operacion', 'nombre', area_operacion);
            if (areaIds) query = query.in('area_id', areaIds);

            const grpIds = await getFilterIds('maestro_rubros', 'nombre', grupo_rubro, { col: 'nivel', val: 2 });
            if (grpIds) query = query.in('grupo_rubro_id', grpIds);

            const rbIds = await getFilterIds('maestro_rubros', 'nombre', rubro || sub_rubro, { col: 'nivel', val: 3 });
            if (rbIds) query = query.in('rubro_id', rbIds);

            const conIds = await getFilterIds('conceptos_presupuesto', 'nombre', concepto);
            if (conIds) query = query.in('concepto_presupuesto_id', conIds);

            if (anio && anio !== 'undefined' && anio !== 'null' && anio !== '') {
                query = query.eq('anio', Number(anio));
            }

            if (mes && mes !== 'undefined' && mes !== 'null' && mes !== '') {
                const mesNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                const mesIndex = mesNames.indexOf(String(mes).toLowerCase());
                if (mesIndex !== -1) query = query.overlaps('meses_aplicables', [mesIndex + 1]);
            }

            const { data } = await query;
            const records = data || [];

            const vehiculosMap = new Map();
            const areasMap = new Map();
            const empresasMap = new Map();
            const gruposMap = new Map();
            const subRubrosMap = new Map();
            const tiposMap = new Map();
            const conceptosMap = new Map();

            records.forEach((r: any) => {
                if (r.vehiculo?.areas_placas) {
                    vehiculosMap.set(r.vehiculo.id, { id: r.vehiculo.id, placa: r.vehiculo.areas_placas.placa });
                }
                if (r.areas_operacion) areasMap.set(r.areas_operacion.id, r.areas_operacion);
                if (r.empresas) empresasMap.set(r.empresas.id, r.empresas);
                if (r.grupo) gruposMap.set(r.grupo.id, r.grupo);
                if (r.rubro) subRubrosMap.set(r.rubro.id, r.rubro);
                if (r.tipo) tiposMap.set(r.tipo.id, r.tipo);
                if (r.concepto) conceptosMap.set(r.concepto.id, r.concepto);
            });

            const currentYear = new Date().getFullYear();
            
            // If no records found but no filters applied, fallback to fetch all distinct to not show empty on first load if tables are huge
            // Actually, we just extracted all from what is in presupuestos! That's perfect.

            res.json({
                vehiculos: Array.from(vehiculosMap.values()).sort((a: any, b: any) => a.placa.localeCompare(b.placa)),
                areas: Array.from(areasMap.values()).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
                empresas: Array.from(empresasMap.values()).sort((a: any, b: any) => a.empresa.localeCompare(b.empresa)),
                grupos_rubro: Array.from(gruposMap.values()).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
                sub_rubros: Array.from(subRubrosMap.values()).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
                tipos_presupuesto: Array.from(tiposMap.values()).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
                conceptos: Array.from(conceptosMap.values()).sort((a: any, b: any) => a.nombre.localeCompare(b.nombre)),
                anios: [currentYear - 1, currentYear, currentYear + 1, currentYear + 2]
            });
        } catch (error) {
            console.error('Error getFilterOptions:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getRubros(req: AuthRequest, res: Response) {
        try {
            const { tipo, nivel, padre_id } = req.query;
            let query = (req.supabase || supabase).from('maestro_rubros').select('*');
            if (tipo) query = query.eq('tipo_rubro', tipo);
            if (nivel) query = query.eq('nivel', Number(nivel));
            if (padre_id) query = query.eq('rubro_padre_id', Number(padre_id));
            query = query.order('codigo');
            const { data, error } = await query;
            if (error) {
                console.error('Supabase error getRubros:', error);
                return res.status(400).json({ error: error.message });
            }
            res.json(data || []);
        } catch (error) {
            console.error('Server error getRubros:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getTipos(req: AuthRequest, res: Response) {
        try {
            const { padre_id } = req.query;
            let query = (req.supabase || supabase).from('tipos_presupuesto').select('*');
            if (padre_id) query = query.eq('padre_id', Number(padre_id));
            query = query.order('nombre');
            const { data } = await query;
            res.json(data || []);
        } catch (error) {
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getConceptos(req: AuthRequest, res: Response) {
        try {
            const { tipo_id } = req.query;
            let query = (req.supabase || supabase).from('conceptos_presupuesto').select('*');
            if (tipo_id) query = query.eq('tipo_presupuesto_id', Number(tipo_id));
            query = query.order('nombre');
            const { data } = await query;
            res.json(data || []);
        } catch (error) {
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

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
                sub_rubro, // maps to tipo_presupuesto_id
                concepto, // maps to concepto_presupuesto_id
                mes,
                f_estado,
                f_ejecucion,
                q,
                sort_by = 'id',
                sort_order = 'desc'
            } = req.query;

            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;

            let query = dbClient
                .from('presupuesto_unificado')
                .select(`
                    *,
                    vehiculo(*, areas_placas(*)),
                    areas_operacion(*),
                    empresas(*),
                    grupo:maestro_rubros!grupo_rubro_id(*),
                    rubro:maestro_rubros!rubro_id(*),
                    personal:Personal(*),
                    tipo:tipos_presupuesto(*),
                    concepto:conceptos_presupuesto(*)
                `, { count: 'exact' });

            const isNum = (v: any) => v && v !== 'undefined' && v !== 'null' && !isNaN(Number(v));
            
            // Helper to get IDs if filter is string
            const getFilterIds = async (table: string, column: string, value: any, extraFilter?: {col: string, val: any}) => {
                if (!value || value === 'undefined' || value === 'null' || value === '') return null; // No filter
                if (isNum(value)) return [Number(value)];
                let q = dbClient.from(table).select('id').ilike(column, `%${String(value).trim()}%`);
                if (extraFilter) q = q.eq(extraFilter.col, extraFilter.val);
                const { data } = await q;
                return data && data.length > 0 ? data.map(d => d.id) : [-1]; // -1 to ensure no match if not found
            };

            let filterVehiculosIds: number[] | null = null;
            const filterPlaca = placa || vehiculo_id;
            if (filterPlaca && filterPlaca !== 'undefined' && filterPlaca !== '' && filterPlaca !== 'null') {
                if (isNum(filterPlaca)) {
                    filterVehiculosIds = [Number(filterPlaca)];
                } else {
                    const { data: placasData } = await dbClient.from('areas_placas').select('id').ilike('placa', `%${String(filterPlaca).trim()}%`);
                    const pIds = placasData?.map(p => p.id) || [];
                    if (pIds.length > 0) {
                        const { data: vehData } = await dbClient.from('vehiculo').select('id').in('placa_id', pIds);
                        filterVehiculosIds = vehData && vehData.length > 0 ? vehData.map(v => v.id) : [-1];
                    } else {
                        filterVehiculosIds = [-1];
                    }
                }
            }
            
            const filterEmpresasIds = await getFilterIds('empresas', 'empresa', empresa);
            const filterAreasIds = await getFilterIds('areas_operacion', 'nombre', area_operacion);
            const filterGruposIds = await getFilterIds('maestro_rubros', 'nombre', grupo_rubro, {col: 'nivel', val: 2});
            const filterRubrosIds = await getFilterIds('maestro_rubros', 'nombre', rubro, {col: 'nivel', val: 3});
            const filterSubRubrosIds = await getFilterIds('tipos_presupuesto', 'nombre', sub_rubro);
            const filterConceptosIds = await getFilterIds('conceptos_presupuesto', 'nombre', concepto);

            if (filterVehiculosIds) query = query.in('vehiculo_id', filterVehiculosIds);
            if (filterEmpresasIds) query = query.in('empresa_id', filterEmpresasIds);
            if (filterAreasIds) query = query.in('area_operacion_id', filterAreasIds);
            if (isNum(anio)) query = query.eq('anio', Number(anio));
            if (filterGruposIds) query = query.in('grupo_rubro_id', filterGruposIds);
            if (filterRubrosIds) query = query.in('rubro_id', filterRubrosIds);
            if (filterSubRubrosIds) query = query.in('tipo_presupuesto_id', filterSubRubrosIds);
            if (filterConceptosIds) query = query.in('concepto_presupuesto_id', filterConceptosIds);
            
            let filterMesNums: number[] = [];
            if (mes && mes !== 'undefined' && mes !== '' && mes !== 'null') {
                const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
                const mesList = String(mes).toLowerCase().trim().split(',').map(s => s.trim()).filter(Boolean);
                
                mesList.forEach(m => {
                    const monthIndex = monthNames.indexOf(m);
                    if (monthIndex !== -1) {
                        filterMesNums.push(monthIndex + 1);
                    }
                });
            }

            if (filterMesNums.length > 0) {
                query = query.overlaps('meses_aplicables', filterMesNums);
            }
            
            // Text search simple for q
            let orQueryString = '';
            if (q && q !== 'undefined' && q !== '' && q !== 'null') {
                const searchTerm = String(q).trim();
                
                let qVehiculosIds: number[] = [];
                const { data: placasData } = await dbClient.from('areas_placas').select('id').ilike('placa', `%${searchTerm}%`);
                const pIds = placasData?.map(p => p.id) || [];
                if (pIds.length > 0) {
                    const { data: vehData } = await dbClient.from('vehiculo').select('id').in('placa_id', pIds);
                    qVehiculosIds = vehData?.map(v => v.id) || [];
                }
                
                const { data: qConceptosData } = await dbClient.from('conceptos_presupuesto').select('id').ilike('nombre', `%${searchTerm}%`);
                const qConceptosIds = qConceptosData?.map(c => c.id) || [];

                const { data: qTiposData } = await dbClient.from('tipos_presupuesto').select('id').ilike('nombre', `%${searchTerm}%`);
                const qTiposIds = qTiposData?.map(c => c.id) || [];

                const { data: qRubrosData } = await dbClient.from('maestro_rubros').select('id').ilike('nombre', `%${searchTerm}%`);
                const qRubrosIds = qRubrosData?.map(c => c.id) || [];

                const orConditions = [];
                // Wrap in double quotes so PostgREST supports spaces/commas inside the OR filter string
                orConditions.push(`nota.ilike."%${searchTerm}%"`);
                if (qVehiculosIds.length > 0) orConditions.push(`vehiculo_id.in.(${qVehiculosIds.join(',')})`);
                if (qConceptosIds.length > 0) orConditions.push(`concepto_presupuesto_id.in.(${qConceptosIds.join(',')})`);
                if (qTiposIds.length > 0) orConditions.push(`tipo_presupuesto_id.in.(${qTiposIds.join(',')})`);
                if (qRubrosIds.length > 0) {
                    orConditions.push(`rubro_id.in.(${qRubrosIds.join(',')})`);
                    orConditions.push(`grupo_rubro_id.in.(${qRubrosIds.join(',')})`);
                }
                
                orQueryString = orConditions.join(',');
                query = query.or(orQueryString);
            }

            if (f_estado && f_estado !== 'undefined' && f_estado !== '') {
                query = query.eq('estado', f_estado);
            }
            if (f_ejecucion && f_ejecucion !== 'undefined' && f_ejecucion !== '') {
                query = query.eq('ejecutado', f_ejecucion === 'EJECUTADO' ? 'SI' : 'NO');
            }

            const ascending = sort_order === 'asc';
            query = query.order(sort_by as string, { ascending });
            query = query.range(offset, offset + limitNum - 1);

            const { data, error, count } = await query;

            if (error) {
                console.error('❌ Error de Supabase en getAll presupuesto_unificado:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            const mappedData = data?.map(row => ({
                id: row.id, // For bulk actions, frontend expects parent id, but here item is parent
                _row_key: `${row.id}`,
                empresa_id: row.empresa_id,
                vehiculo_id: row.vehiculo_id,
                area_operacion_id: row.area_operacion_id,
                grupo_rubro_id: row.grupo_rubro_id,
                rubro_id: row.rubro_id,
                vehiculo: row.vehiculo,
                areas_operacion: row.areas_operacion,
                empresas: row.empresas,
                grupo: row.grupo,
                rubro: row.rubro,
                personal: row.personal,
                anio: row.anio,
                estado: row.estado,
                empleado_id: row.empleado_id,
                presupuesto_items: [
                    {
                        id: row.id,
                        estado: row.estado,
                        ejecutado: row.ejecutado,
                        meses_aplicables: row.meses_aplicables,
                        valor_unitario: row.valor_unitario,
                        frecuencia_mes: row.frecuencia_mes,
                        valor_total: row.valor_total,
                        nota: row.nota,
                        tipo: row.tipo,
                        concepto: row.concepto
                    }
                ],
                _single_item: {
                    id: row.id,
                    estado: row.estado,
                    ejecutado: row.ejecutado,
                    meses_aplicables: row.meses_aplicables,
                    valor_unitario: row.valor_unitario,
                    frecuencia_mes: row.frecuencia_mes,
                    valor_total: row.valor_total,
                    nota: row.nota,
                    tipo: row.tipo,
                    concepto: row.concepto
                }
            })) || [];

            // Summary could be calculated dynamically or fetched entirely if needed, 
            // but for simplicity, we'll return zeroes or calculate based on the page.
            // Ideally, we run another query without pagination to get real totals.
            
            let summaryQuery = dbClient
                .from('presupuesto_unificado')
                .select('valor_total, estado, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes, rubro_id');
                
            if (filterVehiculosIds) summaryQuery = summaryQuery.in('vehiculo_id', filterVehiculosIds);
            if (filterEmpresasIds) summaryQuery = summaryQuery.in('empresa_id', filterEmpresasIds);
            if (filterAreasIds) summaryQuery = summaryQuery.in('area_operacion_id', filterAreasIds);
            if (isNum(anio)) summaryQuery = summaryQuery.eq('anio', Number(anio));
            if (filterGruposIds) summaryQuery = summaryQuery.in('grupo_rubro_id', filterGruposIds);
            if (filterRubrosIds) summaryQuery = summaryQuery.in('rubro_id', filterRubrosIds);
            if (filterSubRubrosIds) summaryQuery = summaryQuery.in('tipo_presupuesto_id', filterSubRubrosIds);
            if (filterConceptosIds) summaryQuery = summaryQuery.in('concepto_presupuesto_id', filterConceptosIds);
            
            if (filterMesNums.length > 0) {
                summaryQuery = summaryQuery.overlaps('meses_aplicables', filterMesNums);
            }
            
            if (q && q !== 'undefined' && q !== '' && q !== 'null' && orQueryString) {
                summaryQuery = summaryQuery.or(orQueryString);
            }
            if (f_estado && f_estado !== 'undefined' && f_estado !== '') {
                summaryQuery = summaryQuery.eq('estado', f_estado);
            }
            if (f_ejecucion && f_ejecucion !== 'undefined' && f_ejecucion !== '') {
                summaryQuery = summaryQuery.eq('ejecutado', f_ejecucion === 'EJECUTADO' ? 'SI' : 'NO');
            }
            
            const { data: summaryData } = await summaryQuery;
            
            let totalAprobado = 0;
            let totalBorrador = 0;
            let totalEjecutado = 0;
            let totalNoEjecutado = 0;
            let totalPresupuesto = 0;
            const rubrosIds = new Set<number>();

            if (summaryData && summaryData.length > 0) {
                summaryData.forEach((item: any) => {
                    const total = item.valor_total || 0;
                    totalPresupuesto += total;
                    if (item.estado === 'APROBADO') totalAprobado += total;
                    else totalBorrador += total;
                    if (item.ejecutado === 'SI') totalEjecutado += total;
                    else totalNoEjecutado += total;
                    if (item.rubro_id) rubrosIds.add(item.rubro_id);
                });
            }

            // --- CÁLCULO DE TOTAL EJECUTADO REAL DESDE MONGODB ---
            let totalEjecutadoReal = 0;
            try {
                // Obtener validacionGrupos dinámica basada en los presupuestos del año actual
                const yearNum = anio && anio !== 'undefined' && anio !== '' ? Number(anio) : new Date().getFullYear();
                
                const { data: presupuestosForValidation } = await dbClient
                    .from('presupuesto_unificado')
                    .select('grupo_rubro_id, grupo:maestro_rubros!grupo_rubro_id(nombre, codigo_concatenado)')
                    .eq('anio', yearNum);

                let validacionGrupos: any = { _id: null }; // Fallback para no coincidir nada
                if (presupuestosForValidation && presupuestosForValidation.length > 0) {
                    const groups = new Set<string>();
                    const codigos = new Set<string>();
                    presupuestosForValidation.forEach((p: any) => {
                        if (p.grupo?.nombre) groups.add(p.grupo.nombre.trim());
                        if (p.grupo?.codigo_concatenado) codigos.add(p.grupo.codigo_concatenado.trim());
                    });

                    const inRegExp = { $in: Array.from(groups).map(g => new RegExp(g, 'i')) };
                    const orFilters: any[] = [
                        { grupoRubro: inRegExp },
                        { nombreGrupoRubro: inRegExp }
                    ];

                    if (codigos.size > 0) {
                        const codesArray = Array.from(codigos);
                        orFilters.push({ grupoRubro: { $in: codesArray } });
                        orFilters.push({ nombreGrupoRubro: { $in: codesArray } });
                    }

                    validacionGrupos = { $or: orFilters };
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
                        
                        let codigos: string[] = [];
                        if (filterGruposIds && filterGruposIds.length > 0) {
                            const { data: grData } = await dbClient.from('maestro_rubros').select('codigo_concatenado').in('id', filterGruposIds);
                            codigos = grData?.map(d => d.codigo_concatenado).filter(Boolean) || [];
                        }

                        const orFilter: any[] = [
                            { grupoRubro: inRegExp },
                            { nombreGrupoRubro: inRegExp }
                        ];

                        if (codigos.length > 0) {
                            orFilter.push({ grupoRubro: { $in: codigos } });
                            orFilter.push({ nombreGrupoRubro: { $in: codigos } });
                        }

                        if (mongoQuery.$and) {
                            mongoQuery.$and.push({ $or: orFilter });
                        } else {
                            mongoQuery.$and = [{ $or: orFilter }];
                        }
                    }
                }
                applyMongoFilter('rubro', rubro);
                applyMongoFilter('subRubro', sub_rubro);

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
                
                if (filterMesNums.length > 0) {
                    const ranges = filterMesNums.map(m => {
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
                data: mappedData,
                pagination: {
                    total: count || 0,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil((count || 0) / limitNum)
                },
                summary: {
                    totalPresupuesto,
                    totalAprobado,
                    totalBorrador,
                    totalEjecutado,
                    totalNoEjecutado,
                    totalEjecutadoReal: totalEjecutadoReal,
                    anioVigencia: anio || new Date().getFullYear(),
                    rubrosUtilizados: rubrosIds.size
                }
            });

        } catch (error) {
            console.error('Error en getAll presupuestos-mantenimiento:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async getById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { id } = req.params;
            const { data, error } = await dbClient
                .from('presupuesto_unificado')
                .select(`
                    *,
                    vehiculo(*, areas_placas(*)),
                    areas_operacion(*),
                    empresas(*),
                    grupo:maestro_rubros!grupo_rubro_id(*),
                    rubro:maestro_rubros!rubro_id(*),
                    personal:Personal(*),
                    tipo:tipos_presupuesto(*),
                    concepto:conceptos_presupuesto(*)
                `)
                .eq('id', id)
                .single();

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const mappedData = {
                id: data.id,
                _row_key: `${data.id}`,
                empresa_id: data.empresa_id,
                vehiculo_id: data.vehiculo_id,
                area_operacion_id: data.area_operacion_id,
                grupo_rubro_id: data.grupo_rubro_id,
                rubro_id: data.rubro_id,
                vehiculo: data.vehiculo,
                areas_operacion: data.areas_operacion,
                empresas: data.empresas,
                grupo: data.grupo,
                rubro: data.rubro,
                personal: data.personal,
                anio: data.anio,
                estado: data.estado,
                empleado_id: data.empleado_id,
                items: [
                    {
                        id: data.id,
                        estado: data.estado,
                        ejecutado: data.ejecutado,
                        meses_aplicables: data.meses_aplicables,
                        valor_unitario: data.valor_unitario,
                        frecuencia_mes: data.frecuencia_mes,
                        valor_total: data.valor_total,
                        nota: data.nota,
                        tipo: data.tipo,
                        concepto: data.concepto,
                        tipo_presupuesto_id: data.tipo_presupuesto_id,
                        concepto_presupuesto_id: data.concepto_presupuesto_id
                    }
                ]
            };

            res.json(mappedData);
        } catch (error) {
            console.error('Error en getById presupuestos-mantenimiento:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    async create(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { items, ...baseFields } = req.body;
            
            let dataToReturn;
            if (items && Array.isArray(items) && items.length > 0) {
                const rowsToInsert = items.map((item: any) => ({
                    ...baseFields,
                    tipo_presupuesto_id: item.tipo_presupuesto_id,
                    concepto_presupuesto_id: item.concepto_presupuesto_id,
                    frecuencia_mes: item.frecuencia_mes,
                    meses_aplicables: item.meses_aplicables,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_unitario * item.frecuencia_mes * (item.meses_aplicables?.length || 0),
                    nota: item.nota,
                    estado: item.estado || 'BORRADOR',
                    ejecutado: item.ejecutado || 'NO'
                }));
                const { data, error } = await dbClient
                    .from('presupuesto_unificado')
                    .insert(rowsToInsert)
                    .select();
                if (error) throw error;
                dataToReturn = data;
            } else {
                const payload = { ...baseFields };
                if (!payload.valor_total && payload.valor_unitario && payload.frecuencia_mes) {
                    const numMeses = (payload.meses_aplicables || []).length;
                    payload.valor_total = payload.valor_unitario * payload.frecuencia_mes * numMeses;
                }
                const { data, error } = await dbClient
                    .from('presupuesto_unificado')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                dataToReturn = data;
            }

            res.status(201).json(dataToReturn);
        } catch (error: any) {
            console.error('Error en create presupuestos-mantenimiento:', error);
            res.status(500).json({ error: error.message || 'Error en el servidor' });
        }
    },

    async update(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { id } = req.params;
            const { items, ...baseFields } = req.body;

            if (items && Array.isArray(items) && items.length > 0) {
                await Promise.all(items.map(async (item: any) => {
                    const payload = {
                        ...baseFields,
                        tipo_presupuesto_id: item.tipo_presupuesto_id,
                        concepto_presupuesto_id: item.concepto_presupuesto_id,
                        frecuencia_mes: item.frecuencia_mes,
                        meses_aplicables: item.meses_aplicables,
                        valor_unitario: item.valor_unitario,
                        valor_total: item.valor_unitario * item.frecuencia_mes * (item.meses_aplicables?.length || 0),
                        nota: item.nota,
                        estado: item.estado || 'BORRADOR',
                        ejecutado: item.ejecutado || 'NO'
                    };
                    if (item.id) {
                        await dbClient.from('presupuesto_unificado').update(payload).eq('id', item.id);
                    } else {
                        await dbClient.from('presupuesto_unificado').insert(payload);
                    }
                }));
                res.json({ message: 'Actualizado correctamente' });
            } else {
                const payload = { ...baseFields };
                const { data: current } = await dbClient.from('presupuesto_unificado').select('*').eq('id', id).single();
                if (!current) {
                    res.status(404).json({ error: 'No encontrado' });
                    return;
                }
                const valor_unitario = payload.valor_unitario !== undefined ? payload.valor_unitario : current.valor_unitario;
                const frecuencia_mes = payload.frecuencia_mes !== undefined ? payload.frecuencia_mes : current.frecuencia_mes;
                const meses_aplicables = payload.meses_aplicables !== undefined ? payload.meses_aplicables : current.meses_aplicables;
                
                payload.valor_total = valor_unitario * frecuencia_mes * (meses_aplicables?.length || 0);

                const { data, error } = await dbClient
                    .from('presupuesto_unificado')
                    .update(payload)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                res.json(data);
            }
        } catch (error: any) {
            console.error('Error en update presupuestos-mantenimiento:', error);
            res.status(500).json({ error: error.message || 'Error en el servidor' });
        }
    },

    async delete(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { id } = req.params;

            const { error } = await dbClient
                .from('presupuesto_unificado')
                .delete()
                .eq('id', id);

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({ message: 'Eliminado correctamente' });
        } catch (error) {
            console.error('Error en delete presupuestos-mantenimiento:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
