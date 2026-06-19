import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

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

                            if (filtersInfo.monthNums.length > 0) {
                                const applicableSelectedMonths = (item.meses_aplicables || []).filter((m: number) => filtersInfo.monthNums.includes(m));
                                if (applicableSelectedMonths.length === 0) return;
                                total = (item.valor_unitario || 0) * (item.frecuencia_mes || 1) * applicableSelectedMonths.length;
                            }

                            totalPresupuesto += total;

                            if (item.estado === 'APROBADO') totalAprobado += total;
                            else totalBorrador += total;

                            if (item.ejecutado === 'SI') totalEjecutado += total;
                            else totalNoEjecutado += total;
                        });
                    }
                });
            }

            res.json({
                totalAprobado,
                totalBorrador,
                totalEjecutado,
                totalNoEjecutado,
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
                let placa = p.empleado_id ? 'PERSONAL' : (p.control_flota?.areas_placas?.placa || 'S/P');
                const tipo = p.empleado_id ? (p.personal?.tipo || 'EMPLEADO') : 'VEHICULO';

                if (!grouped[placa]) {
                    grouped[placa] = {
                        placa,
                        tipo,
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
                        
                        grouped[placa].total_presupuesto += total;
                        if (item.ejecutado === 'SI') {
                            grouped[placa].total_ejecutado += total;
                        }
                    });
                }
            });

            const result = Object.values(grouped).sort((a: any, b: any) => b.total_presupuesto - a.total_presupuesto);

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
                        if (item.ejecutado === 'SI') {
                            grouped[empresa].total_ejecutado += total;
                        }
                    });
                }
            });

            const result = Object.values(grouped).sort((a: any, b: any) => b.total_presupuesto - a.total_presupuesto);

            res.json(result);
        } catch (error) {
            console.error('Error en getByEmpresa presupuestos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
