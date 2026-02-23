import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

// Umbrales para alertas
const LAVADO_THRESHOLD = { normal: 150000, alto: 250000 };
const ENGRASE_THRESHOLD = { normal: 60000, alto: 100000 };

export const engrasesDashboardController = {
    // KPIs Ejecutivos
    async getKPIs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const placa = req.query.placa as string;
            const area_operacion = req.query.area_operacion as string;
            const conductor = req.query.conductor as string;

            let query = supabase.from('engrases_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (conductor) query = query.ilike('conductor', `%${conductor}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const totalLavado = data?.reduce((sum, r) => sum + (r.lavado || 0), 0) || 0;
            const totalEngrase = data?.reduce((sum, r) => sum + (r.engrase || 0), 0) || 0;
            const totalOtros = data?.reduce((sum, r) => sum + (r.otros || 0), 0) || 0;
            const totalGastado = data?.reduce((sum, r) => sum + (r.suma || 0), 0) || 0;
            const totalIntervenciones = data?.length || 0;
            const placasIntervenidas = new Set(data?.map(r => r.placa).filter(Boolean)).size;
            const conductoresActivos = new Set(data?.map(r => r.conductor).filter(Boolean)).size;

            // Conteos por tipo
            const conLavado = data?.filter(r => (r.lavado || 0) > 0).length || 0;
            const conEngrase = data?.filter(r => (r.engrase || 0) > 0).length || 0;
            const conAmbos = data?.filter(r => (r.lavado || 0) > 0 && (r.engrase || 0) > 0).length || 0;

            // Promedios
            const promedioLavado = conLavado > 0 ? totalLavado / conLavado : 0;
            const promedioEngrase = conEngrase > 0 ? totalEngrase / conEngrase : 0;
            const promedioTotal = totalIntervenciones > 0 ? totalGastado / totalIntervenciones : 0;

            res.json({
                totalGastado,
                totalLavado,
                totalEngrase,
                totalOtros,
                totalIntervenciones,
                placasIntervenidas,
                conductoresActivos,
                conLavado,
                conEngrase,
                conAmbos,
                promedioLavado,
                promedioEngrase,
                promedioTotal
            });
        } catch (error) {
            console.error('Error en getKPIs engrases:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Gasto mensual en el tiempo
    async getSpendingOverTime(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const placa = req.query.placa as string;

            let query = supabase.from('engrases_relaciones').select('fecha, lavado, engrase, otros, suma');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (placa) query = query.ilike('placa', `%${placa}%`);

            query = query.order('fecha');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por mes
            const byMonth: Record<string, { mes: string; lavado: number; engrase: number; otros: number; total: number; intervenciones: number }> = {};

            data?.forEach(r => {
                const mes = r.fecha.substring(0, 7); // YYYY-MM
                if (!byMonth[mes]) {
                    byMonth[mes] = { mes, lavado: 0, engrase: 0, otros: 0, total: 0, intervenciones: 0 };
                }
                byMonth[mes].lavado += r.lavado || 0;
                byMonth[mes].engrase += r.engrase || 0;
                byMonth[mes].otros += r.otros || 0;
                byMonth[mes].total += r.suma || 0;
                byMonth[mes].intervenciones += 1;
            });

            res.json(Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes)));
        } catch (error) {
            console.error('Error en getSpendingOverTime:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Comparativo Lavado vs Engrase
    async getServiceComparison(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const placa = req.query.placa as string;

            let query = supabase.from('engrases_relaciones').select('fecha, lavado, engrase');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (placa) query = query.ilike('placa', `%${placa}%`);

            query = query.order('fecha');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por mes
            const byMonth: Record<string, { mes: string; lavado: number; engrase: number; countLavado: number; countEngrase: number }> = {};

            data?.forEach(r => {
                const mes = r.fecha.substring(0, 7);
                if (!byMonth[mes]) {
                    byMonth[mes] = { mes, lavado: 0, engrase: 0, countLavado: 0, countEngrase: 0 };
                }
                byMonth[mes].lavado += r.lavado || 0;
                byMonth[mes].engrase += r.engrase || 0;
                if ((r.lavado || 0) > 0) byMonth[mes].countLavado += 1;
                if ((r.engrase || 0) > 0) byMonth[mes].countEngrase += 1;
            });

            res.json(Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes)));
        } catch (error) {
            console.error('Error en getServiceComparison:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Análisis por placa
    async getByPlaca(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;

            let query = supabase.from('engrases_relaciones').select('placa, conductor, lavado, engrase, otros, suma, fecha');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const byPlaca: Record<string, any> = {};

            data?.forEach(r => {
                const placa = r.placa;
                if (!byPlaca[placa]) {
                    byPlaca[placa] = {
                        placa,
                        conductor: r.conductor,
                        totalLavado: 0,
                        totalEngrase: 0,
                        totalOtros: 0,
                        totalAcumulado: 0,
                        numLavados: 0,
                        numEngrases: 0,
                        numIntervenciones: 0,
                        ultimaFecha: r.fecha
                    };
                }
                const p = byPlaca[placa];
                p.totalLavado += r.lavado || 0;
                p.totalEngrase += r.engrase || 0;
                p.totalOtros += r.otros || 0;
                p.totalAcumulado += r.suma || 0;
                if ((r.lavado || 0) > 0) p.numLavados += 1;
                if ((r.engrase || 0) > 0) p.numEngrases += 1;
                p.numIntervenciones += 1;
                if (r.fecha > p.ultimaFecha) {
                    p.ultimaFecha = r.fecha;
                    p.conductor = r.conductor;
                }
            });

            const result = Object.values(byPlaca).sort((a: any, b: any) => b.totalAcumulado - a.totalAcumulado);
            res.json(result);
        } catch (error) {
            console.error('Error en getByPlaca:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Comportamiento mensual de una placa específica
    async getPlacaMonthly(req: AuthRequest, res: Response): Promise<void> {
        try {
            const placa = req.params.placa;
            const year = req.query.year as string;

            let query = supabase.from('engrases_relaciones')
                .select('fecha, lavado, engrase, otros, suma, observaciones')
                .ilike('placa', `%${placa}%`);

            if (year) {
                query = query.gte('fecha', `${year}-01-01`).lte('fecha', `${year}-12-31`);
            }

            query = query.order('fecha');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por día
            const byDay: Record<string, any> = {};

            data?.forEach(r => {
                const fecha = r.fecha;
                if (!byDay[fecha]) {
                    byDay[fecha] = {
                        fecha,
                        lavado: 0,
                        engrase: 0,
                        otros: 0,
                        total: 0,
                        tieneLabado: false,
                        tieneEngrase: false,
                        observaciones: []
                    };
                }
                byDay[fecha].lavado += r.lavado || 0;
                byDay[fecha].engrase += r.engrase || 0;
                byDay[fecha].otros += r.otros || 0;
                byDay[fecha].total += r.suma || 0;
                if ((r.lavado || 0) > 0) byDay[fecha].tieneLabado = true;
                if ((r.engrase || 0) > 0) byDay[fecha].tieneEngrase = true;
                if (r.observaciones) byDay[fecha].observaciones.push(r.observaciones);
            });

            res.json(Object.values(byDay));
        } catch (error) {
            console.error('Error en getPlacaMonthly:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Gasto por área de operación
    async getByArea(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const placa = req.query.placa as string;

            let query = supabase.from('engrases_relaciones').select('area_operacion, lavado, engrase, otros, suma');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (placa) query = query.ilike('placa', `%${placa}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const byArea: Record<string, any> = {};
            let totalGlobal = 0;

            data?.forEach(r => {
                const area = r.area_operacion || 'SIN ÁREA';
                if (!byArea[area]) {
                    byArea[area] = {
                        area_operacion: area,
                        totalLavado: 0,
                        totalEngrase: 0,
                        totalOtros: 0,
                        totalGasto: 0,
                        intervenciones: 0
                    };
                }
                byArea[area].totalLavado += r.lavado || 0;
                byArea[area].totalEngrase += r.engrase || 0;
                byArea[area].totalOtros += r.otros || 0;
                byArea[area].totalGasto += r.suma || 0;
                byArea[area].intervenciones += 1;
                totalGlobal += r.suma || 0;
            });

            // Calcular porcentajes y ordenar por gasto
            const result = Object.values(byArea)
                .map((a: any) => ({
                    ...a,
                    porcentaje: totalGlobal > 0 ? (a.totalGasto / totalGlobal) * 100 : 0
                }))
                .sort((a: any, b: any) => b.totalGasto - a.totalGasto);

            res.json({ areas: result, totalGlobal });
        } catch (error) {
            console.error('Error en getByArea:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Alertas inteligentes
    async getAlerts(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const placa = req.query.placa as string;

            let query = supabase.from('engrases_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (placa) query = query.ilike('placa', `%${placa}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const alerts: any[] = [];

            // 1. Vehículos con menos de 4 lavados por mes
            const lavadosPorPlacaMes: Record<string, { placa: string; mes: string; count: number }> = {};
            const engrasesPorPlacaMes: Record<string, { placa: string; mes: string; count: number }> = {};

            data?.forEach(r => {
                const mes = r.fecha.substring(0, 7);
                const keyLavado = `${r.placa}|${mes}|L`;
                const keyEngrase = `${r.placa}|${mes}|E`;

                if (!lavadosPorPlacaMes[keyLavado]) {
                    lavadosPorPlacaMes[keyLavado] = { placa: r.placa, mes, count: 0 };
                }
                if (!engrasesPorPlacaMes[keyEngrase]) {
                    engrasesPorPlacaMes[keyEngrase] = { placa: r.placa, mes, count: 0 };
                }

                if ((r.lavado || 0) > 0) lavadosPorPlacaMes[keyLavado].count += 1;
                if ((r.engrase || 0) > 0) engrasesPorPlacaMes[keyEngrase].count += 1;
            });

            // Filtrar placas con menos de 4 lavados en algún mes
            const pocosLavados = Object.values(lavadosPorPlacaMes).filter(item => item.count > 0 && item.count < 4);
            if (pocosLavados.length > 0) {
                alerts.push({
                    tipo_alerta: 'POCOS_LAVADOS',
                    mensaje: `${pocosLavados.length} caso(s) con menos de 4 lavados en un mes`,
                    cantidad: pocosLavados.length,
                    severidad: 'warning',
                    detalles: pocosLavados.sort((a, b) => a.count - b.count)
                });
            }

            // Filtrar placas con menos de 4 engrases en algún mes
            const pocosEngrases = Object.values(engrasesPorPlacaMes).filter(item => item.count > 0 && item.count < 4);
            if (pocosEngrases.length > 0) {
                alerts.push({
                    tipo_alerta: 'POCOS_ENGRASES',
                    mensaje: `${pocosEngrases.length} caso(s) con menos de 4 engrases en un mes`,
                    cantidad: pocosEngrases.length,
                    severidad: 'warning',
                    detalles: pocosEngrases.sort((a, b) => a.count - b.count)
                });
            }

            // 2. Lavados con valor alto
            const lavadosAltos = data?.filter(r => (r.lavado || 0) > LAVADO_THRESHOLD.alto) || [];
            if (lavadosAltos.length > 0) {
                alerts.push({
                    tipo_alerta: 'LAVADO_ALTO',
                    mensaje: `${lavadosAltos.length} registro(s) con lavado mayor a ${LAVADO_THRESHOLD.alto.toLocaleString('es-CO')}`,
                    cantidad: lavadosAltos.length,
                    severidad: 'error'
                });
            }

            // 3. Engrases con valor alto
            const engrasesAltos = data?.filter(r => (r.engrase || 0) > ENGRASE_THRESHOLD.alto) || [];
            if (engrasesAltos.length > 0) {
                alerts.push({
                    tipo_alerta: 'ENGRASE_ALTO',
                    mensaje: `${engrasesAltos.length} registro(s) con engrase mayor a ${ENGRASE_THRESHOLD.alto.toLocaleString('es-CO')}`,
                    cantidad: engrasesAltos.length,
                    severidad: 'error'
                });
            }

            res.json(alerts);
        } catch (error) {
            console.error('Error en getAlerts:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Tabla detallada con paginación
    async getDetailedTable(req: AuthRequest, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const placa = req.query.placa as string;
            const area_operacion = req.query.area_operacion as string;
            const conductor = req.query.conductor as string;

            let query = supabase.from('engrases_relaciones').select('*', { count: 'exact' });

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (conductor) query = query.ilike('conductor', `%${conductor}%`);

            query = query.order('fecha', { ascending: false }).order('id', { ascending: false });

            const { data, error, count } = await query.range(offset, offset + limit - 1);

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agregar tipo de servicio
            const enrichedData = data?.map((r: any) => {
                let tipoServicio = '';
                if ((r.lavado || 0) > 0 && (r.engrase || 0) > 0) {
                    tipoServicio = 'LAVADO Y ENGRASE';
                } else if ((r.lavado || 0) > 0) {
                    tipoServicio = 'LAVADO';
                } else if ((r.engrase || 0) > 0) {
                    tipoServicio = 'ENGRASE';
                } else if ((r.otros || 0) > 0) {
                    tipoServicio = 'OTROS';
                }

                return {
                    ...r,
                    tipo_servicio: tipoServicio,
                    flags: {
                        lavado_alto: (r.lavado || 0) > LAVADO_THRESHOLD.alto,
                        engrase_alto: (r.engrase || 0) > ENGRASE_THRESHOLD.alto
                    }
                };
            });

            res.json({
                data: enrichedData,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            });
        } catch (error) {
            console.error('Error en getDetailedTable:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Obtener registros específicos de una alerta
    async getAlertRecords(req: AuthRequest, res: Response): Promise<void> {
        try {
            const alertType = req.params.alertType as string;
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;

            let query = supabase.from('engrases_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);

            const { data, error } = await query.order('fecha', { ascending: false });

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            let filteredRecords: any[] = [];

            switch (alertType) {
                case 'LAVADO_ALTO':
                    filteredRecords = data?.filter(r => (r.lavado || 0) > LAVADO_THRESHOLD.alto) || [];
                    break;
                case 'ENGRASE_ALTO':
                    filteredRecords = data?.filter(r => (r.engrase || 0) > ENGRASE_THRESHOLD.alto) || [];
                    break;
                case 'GASTOS_RECURRENTES':
                    // Encontrar placas con más de 3 intervenciones por mes
                    const byPlacaMonth: Record<string, any[]> = {};
                    data?.forEach(r => {
                        const key = `${r.placa}|${r.fecha.substring(0, 7)}`;
                        if (!byPlacaMonth[key]) byPlacaMonth[key] = [];
                        byPlacaMonth[key].push(r);
                    });
                    Object.entries(byPlacaMonth).forEach(([, records]) => {
                        if (records.length > 3) {
                            filteredRecords.push(...records);
                        }
                    });
                    break;
                default:
                    filteredRecords = [];
            }

            res.json(filteredRecords);
        } catch (error) {
            console.error('Error en getAlertRecords:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Matriz placa x mes
    async getPlacaMonthMatrix(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const placa = req.query.placa as string;

            let query = supabase.from('engrases_relaciones').select('placa, fecha, lavado, engrase, suma');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (placa) query = query.ilike('placa', `%${placa}%`);

            query = query.order('fecha');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Obtener todos los meses únicos
            const meses = new Set<string>();
            const placaData: Record<string, Record<string, { lavados: number; engrases: number; totalLavado: number; totalEngrase: number }>> = {};

            data?.forEach(r => {
                const mes = r.fecha.substring(0, 7); // YYYY-MM
                const placa = r.placa;
                meses.add(mes);

                if (!placaData[placa]) {
                    placaData[placa] = {};
                }
                if (!placaData[placa][mes]) {
                    placaData[placa][mes] = { lavados: 0, engrases: 0, totalLavado: 0, totalEngrase: 0 };
                }

                if ((r.lavado || 0) > 0) {
                    placaData[placa][mes].lavados += 1;
                    placaData[placa][mes].totalLavado += r.lavado || 0;
                }
                if ((r.engrase || 0) > 0) {
                    placaData[placa][mes].engrases += 1;
                    placaData[placa][mes].totalEngrase += r.engrase || 0;
                }
            });

            // Ordenar meses
            const sortedMeses = Array.from(meses).sort();

            // Construir filas de la matriz
            const matrix = Object.entries(placaData).map(([placa, mesesData]) => {
                const row: any = { placa };
                let totalLavados = 0;
                let totalEngrases = 0;
                let totalValor = 0;

                sortedMeses.forEach(mes => {
                    const d = mesesData[mes] || { lavados: 0, engrases: 0, totalLavado: 0, totalEngrase: 0 };
                    row[mes] = d;
                    totalLavados += d.lavados;
                    totalEngrases += d.engrases;
                    totalValor += d.totalLavado + d.totalEngrase;
                });

                row.totals = { lavados: totalLavados, engrases: totalEngrases, valor: totalValor };
                return row;
            });

            // Ordenar por total de valor descendente
            matrix.sort((a, b) => b.totals.valor - a.totals.valor);

            res.json({
                meses: sortedMeses,
                matrix: matrix.slice(0, 50) // Limitar a 50 placas
            });
        } catch (error) {
            console.error('Error en getPlacaMonthMatrix:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};

