import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';
import { PagoModel } from '../models/pagos.model';

// Función auxiliar para resolver filtros basados en texto a IDs para la consulta principal
async function resolveFilters(req: AuthRequest, dbClient: any) {
    const {
        empresa,
        vehiculo_id,
        placa,
        area_operacion,
        anio,
        grupo_rubro,
        rubro,
        sub_rubro,
        mes
    } = req.query;

    let areaIds: number[] = [];
    if (area_operacion && area_operacion !== 'undefined' && area_operacion !== '') {
        const names = String(area_operacion).split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            const { data } = await dbClient.from('areas_operacion').select('id').in('nombre', names);
            areaIds = data?.map((a: any) => a.id) || [];
        }
    }

    let empresaIds: number[] = [];
    if (empresa && empresa !== 'undefined' && empresa !== '') {
        const names = String(empresa).split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            const { data } = await dbClient.from('empresas').select('id').in('empresa', names);
            empresaIds = data?.map((e: any) => e.id) || [];
        }
    }

    let grupoRubroIds: number[] = [];
    if (grupo_rubro && grupo_rubro !== 'undefined' && grupo_rubro !== '') {
        const names = String(grupo_rubro).split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            const { data } = await dbClient.from('maestro_rubros').select('id').in('nombre', names);
            grupoRubroIds = data?.map((g: any) => g.id) || [];
        }
    }

    let rubroIds: number[] = [];
    if (rubro && rubro !== 'undefined' && rubro !== '') {
        const names = String(rubro).split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            const { data } = await dbClient.from('maestro_rubros').select('id').in('nombre', names);
            rubroIds = data?.map((r: any) => r.id) || [];
        }
    }

    let budgetIdsFromTipo: number[] = [];
    if (sub_rubro && sub_rubro !== 'undefined' && sub_rubro !== '') {
        const names = String(sub_rubro).split(',').map(s => s.trim()).filter(Boolean);
        if (names.length > 0) {
            const { data: tipoData } = await dbClient.from('tipos_presupuesto').select('id').in('nombre', names);
            if (tipoData && tipoData.length > 0) {
                const tipoIds = tipoData.map((t: any) => t.id);
                const { data: itemData } = await dbClient.from('presupuesto_items').select('presupuesto_id').in('tipo_presupuesto_id', tipoIds);
                if (itemData && itemData.length > 0) {
                    budgetIdsFromTipo = [...new Set((itemData as any[]).map(d => Number(d.presupuesto_id)))];
                }
            }
        }
    }

    let vehiculoIdsFromPlaca: number[] = [];
    if (placa && placa !== 'undefined' && placa !== '') {
        const placas = String(placa).split(',').map(s => s.trim()).filter(Boolean);
        if (placas.length > 0) {
            const { data: placaData } = await dbClient.from('areas_placas').select('id').in('placa', placas);
            if (placaData && placaData.length > 0) {
                const placaIds = placaData.map((p: any) => p.id);
                const { data: vData } = await dbClient.from('control_flota').select('id').in('placa_id', placaIds);
                if (vData && vData.length > 0) {
                    vehiculoIdsFromPlaca = vData.map((d: any) => d.id);
                }
            }
        }
    }

    let budgetIdsFromMonth: number[] = [];
    let monthNums: number[] = [];
    if (mes && mes !== 'undefined' && mes !== '') {
        const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mesList = String(mes).toLowerCase().trim().split(',').map(s => s.trim()).filter(Boolean);
        mesList.forEach(m => {
            const index = monthNames.indexOf(m);
            if (index !== -1) monthNums.push(index + 1);
        });
        if (monthNums.length > 0) {
            const { data: itemData } = await dbClient.from('presupuesto_items').select('presupuesto_id').overlaps('meses_aplicables', monthNums);
            if (itemData && itemData.length > 0) {
                budgetIdsFromMonth = [...new Set((itemData as any[]).map(d => Number(d.presupuesto_id)))];
            }
        }
    }

    return {
        areaIds,
        empresaIds,
        grupoRubroIds,
        rubroIds,
        budgetIdsFromTipo,
        vehiculoIdsFromPlaca,
        budgetIdsFromMonth,
        monthNums
    };
}

// Función auxiliar para aplicar los filtros a un query de presupuestos
function applyFiltersToQuery(query: any, filters: any, queryParams: any) {
    const {
        vehiculo_id, anio, area_operacion, empresa, grupo_rubro, rubro, sub_rubro, mes, placa
    } = queryParams;
    
    const {
        areaIds, empresaIds, grupoRubroIds, rubroIds, budgetIdsFromTipo, vehiculoIdsFromPlaca, budgetIdsFromMonth
    } = filters;

    if (vehiculo_id) query = query.eq('vehiculo_id', Number(vehiculo_id));
    if (vehiculoIdsFromPlaca.length > 0) query = query.in('vehiculo_id', vehiculoIdsFromPlaca);
    else if (placa && placa !== 'undefined' && placa !== '') query = query.eq('vehiculo_id', -1);
    
    if (anio && anio !== 'undefined' && anio !== '') query = query.eq('anio', Number(anio));
    
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
        if (budgetIdsFromTipo.length > 0) query = query.in('id', budgetIdsFromTipo);
        else query = query.eq('id', -1);
    }
    
    if (mes && mes !== '' && mes !== 'undefined') {
        if (budgetIdsFromMonth.length > 0) query = query.in('id', budgetIdsFromMonth);
        else query = query.eq('id', -1);
    }

    return query;
}

// Helper para generar la consulta a MongoDB de Pagos
function getMongoQueryForPagos(queryParams: any, monthNums: number[], dynamicValidacionGrupos: any) {
    const mongoQuery: any = {
        activo: true,
        ...dynamicValidacionGrupos
    };

    const applyMongoFilter = (field: string, val: any) => {
        if (!val || val === 'undefined') return;
        const arr = String(val).split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length > 0) {
            mongoQuery[field] = { $in: arr.map(a => new RegExp(a, 'i')) };
        }
    };

    applyMongoFilter('placa', queryParams.placa);
    applyMongoFilter('areaOperacion', queryParams.area_operacion);
    applyMongoFilter('empresa', queryParams.empresa);

    if (queryParams.grupo_rubro && queryParams.grupo_rubro !== 'undefined') {
        const arr = String(queryParams.grupo_rubro).split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length > 0) {
            const inRegExp = { $in: arr.map(a => new RegExp(a, 'i')) };
            
            const orFilter: any[] = [
                { grupoRubro: inRegExp },
                { nombreGrupoRubro: inRegExp }
            ];

            // Extraer los códigos concatenados de la validación dinámica para agregarlos al filtro
            if (dynamicValidacionGrupos && dynamicValidacionGrupos.$or && dynamicValidacionGrupos.$or.length > 2) {
                const codigoObj = dynamicValidacionGrupos.$or[2];
                if (codigoObj && codigoObj.grupoRubro && codigoObj.grupoRubro.$in) {
                    const codigos = codigoObj.grupoRubro.$in;
                    orFilter.push({ grupoRubro: { $in: codigos } });
                    orFilter.push({ nombreGrupoRubro: { $in: codigos } });
                }
            }
            
            if (mongoQuery.$and) {
                mongoQuery.$and.push({ $or: orFilter });
            } else {
                mongoQuery.$and = [{ $or: orFilter }];
            }
        }
    }

    applyMongoFilter('rubro', queryParams.rubro);
    applyMongoFilter('subRubro', queryParams.sub_rubro);

    const yearNum = queryParams.anio && queryParams.anio !== 'undefined' && queryParams.anio !== '' ? Number(queryParams.anio) : new Date().getFullYear();

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

    return mongoQuery;
}

// Helper para obtener validacionGrupos dinámica basada en los presupuestos del año actual
async function getValidacionGruposDinamica(dbClient: any, queryParams: any) {
    const yearNum = queryParams.anio && queryParams.anio !== 'undefined' && queryParams.anio !== '' ? Number(queryParams.anio) : new Date().getFullYear();
    const { data: presupuestosForValidation } = await dbClient
        .from('presupuestos')
        .select('grupo_rubro_id, grupo:maestro_rubros!presupuestos_grupo_rubro_id_fkey(nombre, codigo_concatenado)')
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
    return validacionGrupos;
}

export const presupuestosDashboardController = {
    // KPIs Generales del dashboard
    async getKPIs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const filtersInfo = await resolveFilters(req, dbClient);

            let summaryQuery = dbClient
                .from('presupuestos')
                .select('id, rubro_id, presupuesto_items(estado, valor_total, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes)');

            summaryQuery = applyFiltersToQuery(summaryQuery, filtersInfo, req.query);

            const { data: allMatching, error } = await summaryQuery;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            let totalAprobado = 0;
            let totalBorrador = 0;
            let totalPresupuesto = 0;
            const rubrosIds = new Set<number>();

            if (allMatching && allMatching.length > 0) {
                allMatching.forEach((p: any) => {
                    rubrosIds.add(p.rubro_id);
                    if (p.presupuesto_items) {
                        p.presupuesto_items.forEach((item: any) => {
                            let total = item.valor_total || 0;

                            if (filtersInfo.monthNums.length > 0) {
                                const applicableSelectedMonths = (item.meses_aplicables || []).filter((m: number) => filtersInfo.monthNums.includes(m));
                                if (applicableSelectedMonths.length === 0) return;
                                total = (item.valor_unitario || 0) * (item.frecuencia_mes || 1) * applicableSelectedMonths.length;
                            }

                            totalPresupuesto += total;

                            if (item.estado === 'APROBADO') totalAprobado += total;
                            else totalBorrador += total;
                        });
                    }
                });
            }

            // Ejecutado real de MongoDB
            let totalEjecutadoReal = 0;
            try {
                const dynamicValidacion = await getValidacionGruposDinamica(dbClient, req.query);
                const mongoQuery = getMongoQueryForPagos(req.query, filtersInfo.monthNums, dynamicValidacion);
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
                console.error('Error calculando ejecutado en getKPIs:', mongoError);
            }

            res.json({
                totalAprobado,
                totalBorrador,
                totalEjecutado: totalEjecutadoReal,
                totalNoEjecutado: totalPresupuesto - totalEjecutadoReal,
                totalPresupuesto,
                rubrosUtilizados: rubrosIds.size
            });
        } catch (error) {
            console.error('Error en getKPIs presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Datos por Placa
    async getByPlaca(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const filtersInfo = await resolveFilters(req, dbClient);

            let query = dbClient
                .from('presupuestos')
                .select(`
                    id, 
                    empleado_id,
                    control_flota(id, areas_placas(placa)),
                    personal:Personal!presupuestos_empleado_id_fkey(tipo),
                    grupo:maestro_rubros!presupuestos_grupo_rubro_id_fkey(nombre),
                    rubro:maestro_rubros!presupuestos_rubro_id_fkey(nombre),
                    presupuesto_items(valor_total, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes, nota, tipo:tipos_presupuesto(nombre), concepto:conceptos_presupuesto(nombre))
                `);

            query = applyFiltersToQuery(query, filtersInfo, req.query);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const grouped: any = {};

            data?.forEach((p: any) => {
                let placa = p.empleado_id ? 'PERSONAL' : (p.control_flota?.areas_placas?.placa || 'S/P');
                const tipo = p.empleado_id ? (p.personal?.tipo || 'EMPLEADO') : 'VEHICULO';
                const grupo = (p.grupo?.nombre || 'OTROS COSTOS').toUpperCase().trim();
                const rubro = (p.rubro?.nombre || 'SIN RUBRO').toUpperCase().trim();

                if (!grouped[placa]) {
                    grouped[placa] = { placa, tipo, total_presupuesto: 0, total_ejecutado: 0, grupos: {}, meses_aplicables: new Set() };
                }
                if (!grouped[placa].grupos[grupo]) {
                    grouped[placa].grupos[grupo] = { nombre: grupo, presupuestado: 0, ejecutado: 0, rubros: {}, meses_aplicables: new Set() };
                }
                if (!grouped[placa].grupos[grupo].rubros[rubro]) {
                    grouped[placa].grupos[grupo].rubros[rubro] = { nombre: rubro, presupuestado: 0, ejecutado: 0, subrubros: {}, meses_aplicables: new Set() };
                }

                if (p.presupuesto_items) {
                    p.presupuesto_items.forEach((item: any) => {
                        let total = item.valor_total || 0;
                        if (filtersInfo.monthNums.length > 0) {
                            const applicable = (item.meses_aplicables || []).filter((m: number) => filtersInfo.monthNums.includes(m));
                            if (applicable.length === 0) return;
                            total = (item.valor_unitario || 0) * (item.frecuencia_mes || 1) * applicable.length;
                        }

                        const subrubro = (item.tipo?.nombre || 'SIN SUBRUBRO').toUpperCase().trim();
                        const concepto = (item.concepto?.nombre || 'SIN CONCEPTO').toUpperCase().trim();
                        const nota = (item.nota || '').trim();
                        const meses = item.meses_aplicables || [];

                        if (!grouped[placa].grupos[grupo].rubros[rubro].subrubros[subrubro]) {
                            grouped[placa].grupos[grupo].rubros[rubro].subrubros[subrubro] = { nombre: subrubro, presupuestado: 0, ejecutado: 0, conceptos: [], meses_aplicables: new Set() };
                        }

                        meses.forEach((m: number) => {
                            grouped[placa].meses_aplicables.add(m);
                            grouped[placa].grupos[grupo].meses_aplicables.add(m);
                            grouped[placa].grupos[grupo].rubros[rubro].meses_aplicables.add(m);
                            grouped[placa].grupos[grupo].rubros[rubro].subrubros[subrubro].meses_aplicables.add(m);
                        });

                        grouped[placa].total_presupuesto += total;
                        grouped[placa].grupos[grupo].presupuestado += total;
                        grouped[placa].grupos[grupo].rubros[rubro].presupuestado += total;
                        grouped[placa].grupos[grupo].rubros[rubro].subrubros[subrubro].presupuestado += total;

                        grouped[placa].grupos[grupo].rubros[rubro].subrubros[subrubro].conceptos.push({
                            concepto,
                            nota,
                            meses_aplicables: item.meses_aplicables || [],
                            presupuestado: total,
                            ejecutado: 0
                        });
                    });
                }
            });

            // Reemplazar Ejecutado con datos de Mongo
            try {
                const dynamicValidacion = await getValidacionGruposDinamica(dbClient, req.query);
                const mongoQuery = getMongoQueryForPagos(req.query, filtersInfo.monthNums, dynamicValidacion);
                const aggregateResult = await PagoModel.aggregate([
                    { $match: mongoQuery },
                    {
                        $group: {
                            _id: { 
                                placa: '$placa', 
                                grupoRubro: { $ifNull: ['$grupoRubro', '$nombreGrupoRubro'] }, 
                                rubro: '$rubro', 
                                subRubro: '$subRubro', 
                                concepto: '$concepto', 
                                nota: '$observacionesUsuario' 
                            },
                            meses_aplicables: {
                                $addToSet: {
                                    $cond: {
                                        if: { $or: [{ $ifNull: ['$fechaPago', false] }, { $ifNull: ['$fecha', false] }] },
                                        then: { $month: { $toDate: { $ifNull: ['$fechaPago', '$fecha'] } } },
                                        else: null
                                    }
                                }
                            },
                            totalOperacion: { $sum: '$valorOperacion' }
                        }
                    }
                ]);

                aggregateResult.forEach((resItem) => {
                    if (resItem._id && resItem._id.placa) {
                        const placaMongo = resItem._id.placa;
                        const grupoMongo = (resItem._id.grupoRubro || 'OTROS COSTOS').toUpperCase().trim();
                        const rubroMongo = (resItem._id.rubro || 'SIN RUBRO').toUpperCase().trim();
                        const subrubroMongo = (resItem._id.subRubro || 'SIN SUBRUBRO').toUpperCase().trim();
                        const conceptoMongo = (resItem._id.concepto || 'SIN CONCEPTO').toUpperCase().trim();
                        const notaMongo = (resItem._id.nota || '').trim();
                        const ejecutadoVal = resItem.totalOperacion || 0;

                        if (!grouped[placaMongo]) grouped[placaMongo] = { placa: placaMongo, tipo: 'VEHICULO', total_presupuesto: 0, total_ejecutado: 0, grupos: {}, meses_aplicables: new Set() };
                        if (!grouped[placaMongo].grupos[grupoMongo]) grouped[placaMongo].grupos[grupoMongo] = { nombre: grupoMongo, presupuestado: 0, ejecutado: 0, rubros: {}, meses_aplicables: new Set() };
                        if (!grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo]) grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo] = { nombre: rubroMongo, presupuestado: 0, ejecutado: 0, subrubros: {}, meses_aplicables: new Set() };
                        if (!grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].subrubros[subrubroMongo]) grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].subrubros[subrubroMongo] = { nombre: subrubroMongo, presupuestado: 0, ejecutado: 0, conceptos: [], meses_aplicables: new Set() };

                        grouped[placaMongo].total_ejecutado += ejecutadoVal;
                        grouped[placaMongo].grupos[grupoMongo].ejecutado += ejecutadoVal;
                        grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].ejecutado += ejecutadoVal;
                        grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].subrubros[subrubroMongo].ejecutado += ejecutadoVal;

                        const mesesMongo = (resItem.meses_aplicables || []).filter((m: any) => m !== null);
                        mesesMongo.forEach((m: number) => {
                            grouped[placaMongo].meses_aplicables.add(m);
                            grouped[placaMongo].grupos[grupoMongo].meses_aplicables.add(m);
                            grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].meses_aplicables.add(m);
                            grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].subrubros[subrubroMongo].meses_aplicables.add(m);
                        });

                        // Check if we can map it to an existing concepto to update executed, or push new
                        const conceptoArr = grouped[placaMongo].grupos[grupoMongo].rubros[rubroMongo].subrubros[subrubroMongo].conceptos;
                        let found = false;
                        for (let c of conceptoArr) {
                            if (c.concepto === conceptoMongo) {
                                c.ejecutado += ejecutadoVal;
                                const uniqueMeses = new Set([...c.meses_aplicables, ...mesesMongo]);
                                c.meses_aplicables = Array.from(uniqueMeses);
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            conceptoArr.push({
                                concepto: conceptoMongo,
                                nota: notaMongo,
                                meses_aplicables: mesesMongo,
                                presupuestado: 0,
                                ejecutado: ejecutadoVal
                            });
                        }
                    }
                });
            } catch (mongoError) {
                console.error('Error calculando ejecutado por placa:', mongoError);
            }

            // Convertir objectos a arrays
            const result = Object.values(grouped).map((p: any) => ({
                ...p,
                meses_aplicables: Array.from(p.meses_aplicables).sort((a: any, b: any) => a - b),
                grupos: Object.values(p.grupos).map((g: any) => ({
                    ...g,
                    meses_aplicables: Array.from(g.meses_aplicables).sort((a: any, b: any) => a - b),
                    rubros: Object.values(g.rubros).map((r: any) => ({
                        ...r,
                        meses_aplicables: Array.from(r.meses_aplicables).sort((a: any, b: any) => a - b),
                        subrubros: Object.values(r.subrubros).map((s: any) => ({
                            ...s,
                            meses_aplicables: Array.from(s.meses_aplicables).sort((a: any, b: any) => a - b),
                            conceptos: s.conceptos.sort((a: any, b: any) => b.presupuestado - a.presupuestado)
                        })).sort((a: any, b: any) => b.presupuestado - a.presupuestado)
                    })).sort((a: any, b: any) => b.presupuestado - a.presupuestado)
                })).sort((a: any, b: any) => b.presupuestado - a.presupuestado)
            })).sort((a: any, b: any) => b.total_presupuesto - a.total_presupuesto);

            res.json(result);
        } catch (error) {
            console.error('Error en getByPlaca presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Datos por Empresa
    async getByEmpresa(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const filtersInfo = await resolveFilters(req, dbClient);

            let query = dbClient
                .from('presupuestos')
                .select(`
                    id, 
                    empresa_id,
                    empresas(empresa),
                    presupuesto_items(valor_total, ejecutado, meses_aplicables, valor_unitario, frecuencia_mes)
                `);

            query = applyFiltersToQuery(query, filtersInfo, req.query);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const grouped: any = {};

            data?.forEach((p: any) => {
                const empresa = p.empresas?.empresa || 'SIN EMPRESA';

                if (!grouped[empresa]) {
                    grouped[empresa] = {
                        empresa,
                        total_presupuesto: 0,
                        total_ejecutado: 0
                    };
                }

                if (p.presupuesto_items) {
                    p.presupuesto_items.forEach((item: any) => {
                        let total = item.valor_total || 0;
                        if (filtersInfo.monthNums.length > 0) {
                            const applicable = (item.meses_aplicables || []).filter((m: number) => filtersInfo.monthNums.includes(m));
                            if (applicable.length === 0) return;
                            total = (item.valor_unitario || 0) * (item.frecuencia_mes || 1) * applicable.length;
                        }
                        grouped[empresa].total_presupuesto += total;
                    });
                }
            });

            // Reemplazar Ejecutado con datos de Mongo
            try {
                const dynamicValidacion = await getValidacionGruposDinamica(dbClient, req.query);
                const mongoQuery = getMongoQueryForPagos(req.query, filtersInfo.monthNums, dynamicValidacion);
                const aggregateResult = await PagoModel.aggregate([
                    { $match: mongoQuery },
                    {
                        $group: {
                            _id: '$empresa',
                            totalOperacion: { $sum: '$valorOperacion' }
                        }
                    }
                ]);

                aggregateResult.forEach((resItem) => {
                    const empresaMongo = resItem._id || 'SIN EMPRESA';
                    if (!grouped[empresaMongo]) {
                        grouped[empresaMongo] = {
                            empresa: empresaMongo,
                            total_presupuesto: 0,
                            total_ejecutado: resItem.totalOperacion || 0
                        };
                    } else {
                        grouped[empresaMongo].total_ejecutado = resItem.totalOperacion || 0;
                    }
                });
            } catch (mongoError) {
                console.error('Error calculando ejecutado por empresa:', mongoError);
            }

            const result = Object.values(grouped).sort((a: any, b: any) => b.total_presupuesto - a.total_presupuesto);

            res.json(result);
        } catch (error) {
            console.error('Error en getByEmpresa presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Datos Matriciales: Placa vs Meses
    async getMatrix(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const filtersInfo = await resolveFilters(req, dbClient);

            let query = dbClient
                .from('presupuestos')
                .select(`
                    id, 
                    empleado_id,
                    control_flota(id, areas_placas(placa)),
                    personal:Personal!presupuestos_empleado_id_fkey(tipo),
                    grupo:maestro_rubros!presupuestos_grupo_rubro_id_fkey(nombre),
                    rubro:maestro_rubros!presupuestos_rubro_id_fkey(nombre),
                    presupuesto_items(valor_total, meses_aplicables, valor_unitario, frecuencia_mes, nota, tipo:tipos_presupuesto(nombre), concepto:conceptos_presupuesto(nombre))
                `);

            query = applyFiltersToQuery(query, filtersInfo, req.query);
            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const matrix: any = {};

            data?.forEach((p: any) => {
                let placa = p.empleado_id ? 'PERSONAL' : (p.control_flota?.areas_placas?.placa || 'S/P');
                const tipo = p.empleado_id ? (p.personal?.tipo || 'EMPLEADO') : 'VEHICULO';
                const grupo = (p.grupo?.nombre || 'OTROS COSTOS').toUpperCase().trim();
                const rubro = (p.rubro?.nombre || 'SIN RUBRO').toUpperCase().trim();

                if (!matrix[placa]) {
                    matrix[placa] = { placa, tipo, meses: {} };
                    for (let i = 1; i <= 12; i++) {
                        matrix[placa].meses[i] = { presupuestado: 0, ejecutado: 0, detalles: [] };
                    }
                }

                if (p.presupuesto_items) {
                    p.presupuesto_items.forEach((item: any) => {
                        const meses = item.meses_aplicables || [];
                        const mensualTotal = (item.valor_unitario || 0) * (item.frecuencia_mes || 1);
                        const subrubro = (item.tipo?.nombre || 'SIN SUBRUBRO').toUpperCase().trim();
                        const concepto = (item.concepto?.nombre || 'SIN CONCEPTO').toUpperCase().trim();

                        meses.forEach((m: number) => {
                            if (filtersInfo.monthNums.length > 0 && !filtersInfo.monthNums.includes(m)) return;
                            
                            matrix[placa].meses[m].presupuestado += mensualTotal;
                            matrix[placa].meses[m].detalles.push({
                                tipo: 'PRESUPUESTADO',
                                grupo,
                                rubro,
                                subrubro,
                                concepto,
                                nota: item.nota,
                                valor: mensualTotal
                            });
                        });
                    });
                }
            });

            // Reemplazar Ejecutado con datos de Mongo por mes
            try {
                const dynamicValidacion = await getValidacionGruposDinamica(dbClient, req.query);
                const mongoQuery = getMongoQueryForPagos(req.query, filtersInfo.monthNums, dynamicValidacion);
                const aggregateResult = await PagoModel.aggregate([
                    { $match: mongoQuery },
                    {
                        $group: {
                            _id: { 
                                placa: '$placa', 
                                mes: {
                                    $cond: {
                                        if: { $or: [{ $ifNull: ['$fechaPago', false] }, { $ifNull: ['$fecha', false] }] },
                                        then: { $month: { $toDate: { $ifNull: ['$fechaPago', '$fecha'] } } },
                                        else: null
                                    }
                                },
                                grupoRubro: { $ifNull: ['$grupoRubro', '$nombreGrupoRubro'] }, 
                                rubro: '$rubro', 
                                subRubro: '$subRubro', 
                                concepto: '$concepto',
                                nota: '$observacionesUsuario'
                            },
                            totalOperacion: { $sum: '$valorOperacion' }
                        }
                    }
                ]);

                aggregateResult.forEach((resItem) => {
                    const mesMongo = resItem._id.mes;
                    if (!mesMongo) return; // Si no hay mes, se ignora en la matriz o se pone en un global
                    if (filtersInfo.monthNums.length > 0 && !filtersInfo.monthNums.includes(mesMongo)) return;

                    const placaMongo = resItem._id.placa || 'SIN PLACA';
                    const grupoMongo = (resItem._id.grupoRubro || 'OTROS COSTOS').toUpperCase().trim();
                    const rubroMongo = (resItem._id.rubro || 'SIN RUBRO').toUpperCase().trim();
                    const subrubroMongo = (resItem._id.subRubro || 'SIN SUBRUBRO').toUpperCase().trim();
                    const conceptoMongo = (resItem._id.concepto || 'SIN CONCEPTO').toUpperCase().trim();
                    const ejecutadoVal = resItem.totalOperacion || 0;

                    if (!matrix[placaMongo]) {
                        matrix[placaMongo] = { placa: placaMongo, tipo: 'VEHICULO', meses: {} };
                        for (let i = 1; i <= 12; i++) {
                            matrix[placaMongo].meses[i] = { presupuestado: 0, ejecutado: 0, detalles: [] };
                        }
                    }

                    matrix[placaMongo].meses[mesMongo].ejecutado += ejecutadoVal;
                    matrix[placaMongo].meses[mesMongo].detalles.push({
                        tipo: 'EJECUTADO',
                        grupo: grupoMongo,
                        rubro: rubroMongo,
                        subrubro: subrubroMongo,
                        concepto: conceptoMongo,
                        nota: resItem._id.nota || '',
                        valor: ejecutadoVal
                    });
                });
            } catch (mongoError) {
                console.error('Error calculando ejecutado matricial por placa:', mongoError);
            }

            // Convertir objectos a arrays
            const result = Object.values(matrix).map((p: any) => {
                let totalPresupuesto = 0;
                Object.values(p.meses).forEach((m: any) => totalPresupuesto += m.presupuestado);
                return { ...p, total_presupuesto: totalPresupuesto };
            }).sort((a: any, b: any) => b.total_presupuesto - a.total_presupuesto);

            res.json(result);
        } catch (error) {
            console.error('Error en getMatrix presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
