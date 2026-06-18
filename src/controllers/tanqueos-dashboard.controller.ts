import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

// Configuración de umbrales para alertas
const FUEL_PRICE_THRESHOLDS = {
    ACPM: { min: 9000, max: 15000 },
    GASOLINA: { min: 10000, max: 16000 },
    'EXTRA': { min: 11000, max: 17000 }
};

const SALDO_CRITICO = -500000;

const applyFilter = (q: any, field: string, value: string) => {
    if (!value) return q;
    const arr = value.split(',').map(s => s.trim()).filter(Boolean);
    if (arr.length === 0) return q;
    return q.in(field, arr);
};

const isCostoAnormal = (t: any, limitesData?: any[]) => {
    if (t.costo_por_galon === null || t.costo_por_galon === undefined || !t.tipo_combustible) return false;
    
    const costo = Number(t.costo_por_galon);
    let min = null;
    let max = null;
    
    if (limitesData && t.fecha) {
        const fechaTanqueo = t.fecha.split('T')[0];
        const limite = limitesData.find((l: any) => 
            l.tipo_combustible === t.tipo_combustible &&
            fechaTanqueo >= l.fecha_inicio && fechaTanqueo <= l.fecha_final
        );
        if (limite && limite.lit_inferior != null && limite.lit_superior != null) {
            min = Number(limite.lit_inferior);
            max = Number(limite.lit_superior);
        }
    }
    
    if (min === null || max === null || isNaN(min) || isNaN(max)) {
        const threshold = FUEL_PRICE_THRESHOLDS[t.tipo_combustible as keyof typeof FUEL_PRICE_THRESHOLDS];
        if (!threshold) return false;
        min = threshold.min;
        max = threshold.max;
    }
    
    return costo < min || costo > max;
};

export const tanqueosDashboardController = {
    // KPIs Ejecutivos
    async getKPIs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            // Query base con filtros
            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            // Solo tanqueos (no anticipos)
            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query.order('fecha', { ascending: false }).limit(100000);

            if (error) {
                console.error('Error en getKPIs:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            // Calcular KPIs
            const totalGalones = data?.reduce((sum, t) => sum + (t.cantidad_galones || 0), 0) || 0;
            const totalValor = data?.reduce((sum, t) => sum + (t.valor_tanqueo || 0), 0) || 0;
            const totalSaldo = data?.reduce((sum, t) => sum + (t.saldo_disponible || 0), 0) || 0;
            const numTanqueos = data?.length || 0;
            const promedioGalonesPorTanqueo = numTanqueos > 0 ? totalGalones / numTanqueos : 0;
            const costoPromedioGalon = totalGalones > 0 ? totalValor / totalGalones : 0;

            // Vehículos y conductores únicos
            const vehiculosActivos = new Set(data?.map(t => t.placa).filter(Boolean)).size;
            const conductoresActivos = new Set(data?.map(t => t.conductor).filter(Boolean)).size;

            // % sin horómetro
            const sinHorometro = data?.filter(t => !t.horometro && t.fecha && new Date(t.fecha).getFullYear() >= 2026 && t.tipo_combustible === 'ACPM').length || 0;
            const porcentajeSinHorometro = numTanqueos > 0 ? (sinHorometro / numTanqueos) * 100 : 0;

            // KPIs por tipo de combustible
            const porCombustible: any = {};
            data?.forEach(t => {
                const tipo = t.tipo_combustible || 'SIN ESPECIFICAR';
                if (!porCombustible[tipo]) {
                    porCombustible[tipo] = {
                        galones: 0,
                        valor: 0,
                        cantidad: 0
                    };
                }
                porCombustible[tipo].galones += t.cantidad_galones || 0;
                porCombustible[tipo].valor += t.valor_tanqueo || 0;
                porCombustible[tipo].cantidad += 1;
            });

            // Calcular promedio de costo por galón por combustible
            Object.keys(porCombustible).forEach(tipo => {
                const data = porCombustible[tipo];
                data.costoPromedioGalon = data.galones > 0 ? data.valor / data.galones : 0;
            });

            // KPIs de costo por área de operación y tipo de combustible (solo ACPM y GASOLINA)
            const costoPorArea: any = {};
            const mainFuelTypes = ['ACPM', 'GASOLINA'];

            data?.forEach(t => {
                const area = t.area_operacion || 'SIN ÁREA';
                const tipo = t.tipo_combustible || 'SIN ESPECIFICAR';

                // Solo incluir ACPM y GASOLINA
                if (!mainFuelTypes.includes(tipo)) return;

                if (!costoPorArea[area]) {
                    costoPorArea[area] = {};
                }
                if (!costoPorArea[area][tipo]) {
                    costoPorArea[area][tipo] = { galones: 0, valor: 0 };
                }
                costoPorArea[area][tipo].galones += t.cantidad_galones || 0;
                costoPorArea[area][tipo].valor += t.valor_tanqueo || 0;
            });

            // Calcular costo promedio por área
            Object.keys(costoPorArea).forEach(area => {
                Object.keys(costoPorArea[area]).forEach(tipo => {
                    const d = costoPorArea[area][tipo];
                    d.costoPromedioGalon = d.galones > 0 ? d.valor / d.galones : 0;
                });
            });

            // Consumo diario/mensual (últimos 30 días si no hay filtro de fecha)
            const consumoDiario: any = {};
            data?.forEach(t => {
                const fecha = t.fecha;
                if (!consumoDiario[fecha]) {
                    consumoDiario[fecha] = { galones: 0, valor: 0 };
                }
                consumoDiario[fecha].galones += t.cantidad_galones || 0;
                consumoDiario[fecha].valor += t.valor_tanqueo || 0;
            });

            res.json({
                global: {
                    totalGalones,
                    totalValor,
                    totalSaldo,
                    numTanqueos,
                    promedioGalonesPorTanqueo,
                    costoPromedioGalon,
                    vehiculosActivos,
                    conductoresActivos,
                    porcentajeSinHorometro
                },
                porCombustible,
                costoPorArea,
                consumoDiario
            });
        } catch (error) {
            console.error('Error obteniendo KPIs:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Saldos de Bombas para dashboard (RLS automático via req.supabase)
    async getSaldosBombas(req: AuthRequest, res: Response): Promise<void> {
        try {
            // Usar cliente autenticado para que RLS aplique automáticamente
            const dbClient = req.supabase || supabase;

            const { data, error } = await dbClient
                .from('saldos_bombas')
                .select('*')
                .eq('actividad', 'ACTIVADA')
                .order('saldo_disponible', { ascending: true });

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Calcular totales y estadísticas
            const bombas = data || [];
            const totalSaldo = bombas.reduce((sum, b) => sum + (b.saldo_disponible || 0), 0);
            const saldosNegativos = bombas.filter(b => (b.saldo_disponible || 0) < 0);
            const saldosCriticos = bombas.filter(b => (b.saldo_disponible || 0) < -500000);
            const saldosBajos = bombas.filter(b => (b.saldo_disponible || 0) >= -500000 && (b.saldo_disponible || 0) < 0);

            res.json({
                bombas,
                stats: {
                    totalBombas: bombas.length,
                    totalSaldo,
                    numNegativos: saldosNegativos.length,
                    numCriticos: saldosCriticos.length,
                    numBajos: saldosBajos.length,
                    numPositivos: bombas.length - saldosNegativos.length
                }
            });
        } catch (error) {
            console.error('Error en getSaldosBombas:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Consumo en el tiempo
    async getConsumptionOverTime(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('fecha, tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);

            query = query.eq('tipo_operacion', 'TANQUEO').order('fecha');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por fecha y tipo_combustible
            const grouped: any = {};
            data?.forEach(t => {
                const key = `${t.fecha}|${t.tipo_combustible}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        fecha: t.fecha,
                        tipo_combustible: t.tipo_combustible,
                        galones: 0,
                        valor: 0,
                        tanqueos: 0
                    };
                }
                grouped[key].galones += t.cantidad_galones || 0;
                grouped[key].valor += t.valor_tanqueo || 0;
                grouped[key].tanqueos += 1;
            });

            res.json(Object.values(grouped));
        } catch (error) {
            console.error('Error en getConsumptionOverTime:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Participación por tipo de combustible
    async getFuelDistribution(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por tipo_combustible
            const grouped: any = {};
            let totalGalones = 0;
            let totalValor = 0;

            data?.forEach(t => {
                const tipo = t.tipo_combustible || 'SIN ESPECIFICAR';
                if (!grouped[tipo]) {
                    grouped[tipo] = {
                        tipo_combustible: tipo,
                        total_galones: 0,
                        total_valor: 0
                    };
                }
                grouped[tipo].total_galones += t.cantidad_galones || 0;
                grouped[tipo].total_valor += t.valor_tanqueo || 0;
                totalGalones += t.cantidad_galones || 0;
                totalValor += t.valor_tanqueo || 0;
            });

            // Calcular porcentajes
            const result = Object.values(grouped).map((item: any) => ({
                ...item,
                porcentaje_galones: totalGalones > 0 ? (item.total_galones / totalGalones) * 100 : 0,
                porcentaje_valor: totalValor > 0 ? (item.total_valor / totalValor) * 100 : 0
            }));

            res.json(result);
        } catch (error) {
            console.error('Error en getFuelDistribution:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Consumo por área de operación
    async getByArea(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const tipo_combustible = req.query.tipo_combustible as string;
            const area_operacion = req.query.area_operacion as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('area_operacion, tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por área y combustible
            const grouped: any = {};
            data?.forEach(t => {
                const key = `${t.area_operacion}|${t.tipo_combustible}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        area_operacion: t.area_operacion,
                        tipo_combustible: t.tipo_combustible,
                        galones: 0,
                        valor: 0
                    };
                }
                grouped[key].galones += t.cantidad_galones || 0;
                grouped[key].valor += t.valor_tanqueo || 0;
            });

            res.json(Object.values(grouped));
        } catch (error) {
            console.error('Error en getByArea:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Top 10 vehículos
    async getTopVehicles(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('placa, tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por placa y combustible
            const grouped: any = {};
            data?.forEach(t => {
                const key = `${t.placa}|${t.tipo_combustible}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        placa: t.placa,
                        tipo_combustible: t.tipo_combustible,
                        total_galones: 0,
                        total_valor: 0
                    };
                }
                grouped[key].total_galones += t.cantidad_galones || 0;
                grouped[key].total_valor += t.valor_tanqueo || 0;
            });

            // Ordenar y limitar a top 10
            const result = Object.values(grouped)
                .sort((a: any, b: any) => b.total_galones - a.total_galones)
                .slice(0, 10);

            res.json(result);
        } catch (error) {
            console.error('Error en getTopVehicles:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Vehículos por área de operación (agrupado por vehículo)
    async getVehiclesByArea(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;

            // Obtener solo últimos 2 meses si no hay filtro
            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('placa, area_operacion, conductor, tipo_combustible, cantidad_galones, valor_tanqueo, fecha');

            if (fecha_inicio) {
                query = query.gte('fecha', fecha_inicio);
            } else {
                // Por defecto, últimos 2 meses
                const twoMonthsAgo = new Date();
                twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
                query = query.gte('fecha', twoMonthsAgo.toISOString().split('T')[0]);
            }
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);

            query = query.eq('tipo_operacion', 'TANQUEO').order('fecha', { ascending: false });

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const meses = req.query.meses as string;
            let filteredData = data || [];
            if (meses) {
                const mesesArr = meses.split(',').map(m => m.trim()).filter(Boolean);
                if (mesesArr.length > 0) {
                    filteredData = filteredData.filter(t => {
                        if (!t.fecha) return false;
                        const datePart = t.fecha.includes('T') ? t.fecha.split('T')[0] : t.fecha;
                        const parts = datePart.split('-');
                        const month = parts[1];
                        return mesesArr.includes(month);
                    });
                }
            }

            // Agrupar por vehículo primero, luego por área
            const byVehicle: any = {};

            filteredData.forEach(t => {
                const placa = t.placa;
                const area = t.area_operacion || 'SIN ÁREA';

                if (!byVehicle[placa]) {
                    byVehicle[placa] = {
                        placa,
                        conductor: t.conductor,
                        ultimoTanqueo: t.fecha,
                        areas: {},
                        totalGalones: 0,
                        totalValor: 0,
                        numTanqueos: 0
                    };
                }

                // Actualizar datos globales del vehículo
                const vehiculo = byVehicle[placa];
                vehiculo.totalGalones += t.cantidad_galones || 0;
                vehiculo.totalValor += t.valor_tanqueo || 0;
                vehiculo.numTanqueos += 1;

                // Actualizar último tanqueo y conductor
                if (t.fecha > vehiculo.ultimoTanqueo) {
                    vehiculo.ultimoTanqueo = t.fecha;
                    vehiculo.conductor = t.conductor;
                }

                // Agrupar por área
                if (!vehiculo.areas[area]) {
                    vehiculo.areas[area] = {
                        area_operacion: area,
                        ultimaFecha: t.fecha,
                        galones: 0,
                        valor: 0,
                        numTanqueos: 0
                    };
                }

                const areaData = vehiculo.areas[area];
                areaData.galones += t.cantidad_galones || 0;
                areaData.valor += t.valor_tanqueo || 0;
                areaData.numTanqueos += 1;

                if (t.fecha > areaData.ultimaFecha) {
                    areaData.ultimaFecha = t.fecha;
                }
            });

            // Convertir areas a array y ordenar vehículos por último tanqueo
            const result = Object.values(byVehicle).map((v: any) => ({
                ...v,
                areas: Object.values(v.areas).sort((a: any, b: any) =>
                    new Date(b.ultimaFecha).getTime() - new Date(a.ultimaFecha).getTime()
                ),
                numAreas: Object.keys(v.areas).length
            })).sort((a: any, b: any) =>
                new Date(b.ultimoTanqueo).getTime() - new Date(a.ultimoTanqueo).getTime()
            );

            res.json(result);
        } catch (error) {
            console.error('Error en getVehiclesByArea:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Consumo por conductor
    async getByDriver(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('conductor, tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por conductor y combustible
            const grouped: any = {};
            data?.forEach(t => {
                const key = `${t.conductor}|${t.tipo_combustible}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        conductor: t.conductor,
                        tipo_combustible: t.tipo_combustible,
                        total_galones: 0,
                        total_valor: 0,
                        num_tanqueos: 0
                    };
                }
                grouped[key].total_galones += t.cantidad_galones || 0;
                grouped[key].total_valor += t.valor_tanqueo || 0;
                grouped[key].num_tanqueos += 1;
            });

            // Ordenar por galones descendente
            const result = Object.values(grouped)
                .sort((a: any, b: any) => b.total_galones - a.total_galones);

            res.json(result);
        } catch (error) {
            console.error('Error en getByDriver:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Consumo por bomba
    async getByPump(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('bomba, tipo_combustible, cantidad_galones, valor_tanqueo');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por bomba y combustible
            const grouped: any = {};
            data?.forEach(t => {
                const key = `${t.bomba}|${t.tipo_combustible}`;
                if (!grouped[key]) {
                    grouped[key] = {
                        bomba: t.bomba,
                        tipo_combustible: t.tipo_combustible,
                        total_galones: 0,
                        total_valor: 0
                    };
                }
                grouped[key].total_galones += t.cantidad_galones || 0;
                grouped[key].total_valor += t.valor_tanqueo || 0;
            });

            res.json(Object.values(grouped));
        } catch (error) {
            console.error('Error en getByPump:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Alertas inteligentes
    async getAlerts(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query.order('fecha', { ascending: false }).limit(100000);
            const { data: limitesData } = await (req.supabase || supabase).from('limites_combustible').select('*');

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const alerts: any[] = [];

            // 1. Tanqueos sin horómetro
            const sinHorometro = data?.filter(t => !t.horometro && t.fecha && new Date(t.fecha).getFullYear() >= 2026 && t.tipo_combustible === 'ACPM').length || 0;
            if (sinHorometro > 0) {
                alerts.push({
                    tipo_alerta: 'SIN_HOROMETRO',
                    mensaje: `${sinHorometro} tanqueo(s) sin registro de horómetro`,
                    cantidad: sinHorometro,
                    severidad: 'warning'
                });
            }

            // 2. Costos por galón fuera de rango
            const costosAnormales = data?.filter(t => isCostoAnormal(t, limitesData || [])).length || 0;

            if (costosAnormales > 0) {
                alerts.push({
                    tipo_alerta: 'COSTO_ANORMAL',
                    mensaje: `${costosAnormales} tanqueo(s) con costo por galón fuera de rango esperado`,
                    cantidad: costosAnormales,
                    severidad: 'error'
                });
            }



            // 4. Consumo atípico (desviación > 2σ)
            const galones = data?.map(t => t.cantidad_galones || 0).filter(g => g > 0) || [];
            if (galones.length > 0) {
                const mean = galones.reduce((sum, g) => sum + g, 0) / galones.length;
                const variance = galones.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / galones.length;
                const stdDev = Math.sqrt(variance);
                const threshold = mean + (2 * stdDev);

                const consumoAtipico = data?.filter(t => (t.cantidad_galones || 0) > threshold).length || 0;
                if (consumoAtipico > 0) {
                    alerts.push({
                        tipo_alerta: 'CONSUMO_ATIPICO',
                        mensaje: `${consumoAtipico} tanqueo(s) con consumo atípicamente alto (> 2σ)`,
                        cantidad: consumoAtipico,
                        severidad: 'warning'
                    });
                }
            }

            res.json(alerts);
        } catch (error) {
            console.error('Error en getAlerts:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Tabla detallada con indicadores
    async getDetailedTable(req: AuthRequest, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = (page - 1) * limit;

            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('*', { count: 'exact' });

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO')
                .order('fecha', { ascending: false })
                .order('id', { ascending: false });

            const { data, error, count } = await query.range(offset, offset + limit - 1);
            const { data: limitesData } = await (req.supabase || supabase).from('limites_combustible').select('*');

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            // Agregar flags a cada registro
            const enrichedData = data?.map((t: any) => {
                return {
                    ...t,
                    flags: {
                        sin_horometro: !t.horometro && t.fecha && new Date(t.fecha).getFullYear() >= 2026 && t.tipo_combustible === 'ACPM',
                        costo_anormal: isCostoAnormal(t, limitesData || [])
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
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO');

            const { data, error } = await query.order('fecha', { ascending: false }).limit(100000);
            const { data: limitesData } = await (req.supabase || supabase).from('limites_combustible').select('*');

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            let filteredRecords: any[] = [];

            switch (alertType) {
                case 'SIN_HOROMETRO':
                    filteredRecords = data?.filter(t => !t.horometro && t.fecha && new Date(t.fecha).getFullYear() >= 2026 && t.tipo_combustible === 'ACPM') || [];
                    break;

                case 'COSTO_ANORMAL':
                    filteredRecords = data?.filter(t => isCostoAnormal(t, limitesData || [])) || [];
                    break;



                case 'CONSUMO_ATIPICO':
                    const galones = data?.map(t => t.cantidad_galones || 0).filter(g => g > 0) || [];
                    if (galones.length > 0) {
                        const mean = galones.reduce((sum, g) => sum + g, 0) / galones.length;
                        const variance = galones.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / galones.length;
                        const stdDev = Math.sqrt(variance);
                        const threshold = mean + (2 * stdDev);
                        filteredRecords = data?.filter(t => (t.cantidad_galones || 0) > threshold) || [];
                    }
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

    // Rendimiento mensual de vehículos (usando vista preexistente)
    async getVehiclePerformance(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = req.supabase || supabase;
            const { mes, vehiculo, area_operacion, fecha_inicio, fecha_fin } = req.query;

            let query = dbClient.from('rendimiento_mensual_vehiculo').select('*');

            if (mes) query = query.eq('mes', mes);
            if (fecha_inicio) query = query.gte('mes', fecha_inicio);
            if (fecha_fin) query = query.lte('mes', fecha_fin);
            if (vehiculo) query = applyFilter(query, 'vehiculo', vehiculo as string);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion as string);

            const { data, error } = await query.order('mes', { ascending: false }).order('vehiculo');

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            res.json(data);
        } catch (error) {
            console.error('Error en getVehiclePerformance:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Dashboard Full Data (Consolidado para velocidad)
    async getFullData(req: AuthRequest, res: Response): Promise<void> {
        try {
            const fecha_inicio = req.query.fecha_inicio as string;
            const fecha_fin = req.query.fecha_fin as string;
            const conductor = req.query.conductor as string;
            const placa = req.query.placa as string;
            const bomba = req.query.bomba as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_combustible = req.query.tipo_combustible as string;

            // 1. Fetch saldos_bombas en paralelo (no depende de filtros de tanqueo)
            const saldosPromise = (req.supabase || supabase)
                .from('saldos_bombas')
                .select('*')
                .eq('actividad', 'ACTIVADA')
                .order('saldo_disponible', { ascending: true });

            // 2. Fetch all filtered tanqueo records for aggregation
            let query = (req.supabase || supabase).from('tanqueo_relaciones').select('*');

            if (fecha_inicio) query = query.gte('fecha', fecha_inicio);
            if (fecha_fin) query = query.lte('fecha', fecha_fin);
            if (conductor) query = applyFilter(query, 'conductor', conductor);
            if (placa) query = applyFilter(query, 'placa', placa);
            if (bomba) query = applyFilter(query, 'bomba', bomba);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);
            if (tipo_combustible) query = applyFilter(query, 'tipo_combustible', tipo_combustible);

            query = query.eq('tipo_operacion', 'TANQUEO').order('fecha', { ascending: false }).limit(100000);

            const limitesPromise = (req.supabase || supabase).from('limites_combustible').select('*');
            const [saldosRes, tanqueosRes, limitesRes] = await Promise.all([saldosPromise, query, limitesPromise]);

            if (tanqueosRes.error) throw tanqueosRes.error;
            if (saldosRes.error) throw saldosRes.error;
            if (limitesRes.error) throw limitesRes.error;
            
            const limitesData = limitesRes.data || [];

            const meses = req.query.meses as string;
            let data = tanqueosRes.data || [];
            if (meses) {
                const mesesArr = meses.split(',').map(m => m.trim()).filter(Boolean);
                if (mesesArr.length > 0) {
                    data = data.filter(t => {
                        if (!t.fecha) return false;
                        // Support ISO timestamp or YYYY-MM-DD date formats
                        const datePart = t.fecha.includes('T') ? t.fecha.split('T')[0] : t.fecha;
                        const parts = datePart.split('-');
                        const month = parts[1]; // e.g. "05"
                        return mesesArr.includes(month);
                    });
                }
            }
            const bombas = saldosRes.data || [];

            // --- AGREGACIONES EN MEMORIA (MUCHO MÁS RÁPIDO QUE SQL MÚLTIPLE) ---

            // KPIs & Distribution
            let totalGalones = 0;
            let totalValor = 0;
            let totalSaldo = 0;
            let sinHorometro = 0;
            const porCombustible: any = {};
            const costoPorArea: any = {};
            const consumptionTime: any = {};
            const fuelDistribution: any = {};
            const byArea: any = {};
            const topVehicles: any = {};
            const mainFuelTypes = ['ACPM', 'GASOLINA'];

            data.forEach(t => {
                const gal = t.cantidad_galones || 0;
                const val = t.valor_tanqueo || 0;
                const tipo = t.tipo_combustible || 'SIN ESPECIFICAR';
                const area = t.area_operacion || 'SIN ÁREA';
                const fecha = t.fecha;
                const veh = t.placa || 'SIN PLACA';

                totalGalones += gal;
                totalValor += val;
                totalSaldo += t.saldo_disponible || 0;
                if (!t.horometro && t.fecha && new Date(t.fecha).getFullYear() >= 2026 && t.tipo_combustible === 'ACPM') sinHorometro++;

                // porCombustible (KPIs)
                if (!porCombustible[tipo]) porCombustible[tipo] = { galones: 0, valor: 0, cantidad: 0 };
                porCombustible[tipo].galones += gal;
                porCombustible[tipo].valor += val;
                porCombustible[tipo].cantidad++;

                // costoPorArea
                if (mainFuelTypes.includes(tipo)) {
                    if (!costoPorArea[area]) costoPorArea[area] = {};
                    if (!costoPorArea[area][tipo]) costoPorArea[area][tipo] = { galones: 0, valor: 0 };
                    costoPorArea[area][tipo].galones += gal;
                    costoPorArea[area][tipo].valor += val;
                }

                // Consumption Over Time
                const timeKey = `${fecha}|${tipo}`;
                if (!consumptionTime[timeKey]) consumptionTime[timeKey] = { fecha, tipo_combustible: tipo, galones: 0, valor: 0, tanqueos: 0 };
                consumptionTime[timeKey].galones += gal;
                consumptionTime[timeKey].valor += val;
                consumptionTime[timeKey].tanqueos += 1;

                // Fuel Distribution
                if (!fuelDistribution[tipo]) fuelDistribution[tipo] = { tipo_combustible: tipo, total_galones: 0, total_valor: 0 };
                fuelDistribution[tipo].total_galones += gal;
                fuelDistribution[tipo].total_valor += val;

                // By Area
                const areaKey = `${area}|${tipo}`;
                if (!byArea[areaKey]) byArea[areaKey] = { area_operacion: area, tipo_combustible: tipo, galones: 0, valor: 0 };
                byArea[areaKey].galones += gal;
                byArea[areaKey].valor += val;

                // Top Vehicles
                const vehKey = `${veh}|${tipo}`;
                if (!topVehicles[vehKey]) topVehicles[vehKey] = { placa: veh, tipo_combustible: tipo, total_galones: 0, total_valor: 0 };
                topVehicles[vehKey].total_galones += gal;
                topVehicles[vehKey].total_valor += val;
            });

            // Post-processing aggregations
            const numTanqueos = data.length;
            Object.values(porCombustible).forEach((d: any) => d.costoPromedioGalon = d.galones > 0 ? d.valor / d.galones : 0);
            Object.values(costoPorArea).forEach((areaObj: any) => {
                Object.values(areaObj).forEach((d: any) => d.costoPromedioGalon = d.galones > 0 ? d.valor / d.galones : 0);
            });

            const fuelDistResult = Object.values(fuelDistribution).map((item: any) => ({
                ...item,
                porcentaje_galones: totalGalones > 0 ? (item.total_galones / totalGalones) * 100 : 0,
                porcentaje_valor: totalValor > 0 ? (item.total_valor / totalValor) * 100 : 0
            }));

            const topVehiclesResult = Object.values(topVehicles)
                .sort((a: any, b: any) => b.total_galones - a.total_galones)
                .slice(0, 10);

            // Alerts logic
            const alerts: any[] = [];
            if (sinHorometro > 0) alerts.push({ tipo_alerta: 'SIN_HOROMETRO', mensaje: `${sinHorometro} tanqueo(s) sin registro de horómetro`, cantidad: sinHorometro, severidad: 'warning' });
            
            const costsAnormales = data.filter(t => isCostoAnormal(t, limitesData)).length;
            if (costsAnormales > 0) alerts.push({ tipo_alerta: 'COSTO_ANORMAL', mensaje: `${costsAnormales} tanqueo(s) con costo por galón fuera de rango`, cantidad: costsAnormales, severidad: 'error' });



            // Stats for pumps
            const totalSaldoBombas = bombas.reduce((sum, b) => sum + (b.saldo_disponible || 0), 0);
            const numNegativos = bombas.filter(b => (b.saldo_disponible || 0) < 0).length;

            res.json({
                kpis: {
                    global: {
                        totalGalones,
                        totalValor,
                        totalSaldo,
                        numTanqueos,
                        promedioGalonesPorTanqueo: numTanqueos > 0 ? totalGalones / numTanqueos : 0,
                        costoPromedioGalon: totalGalones > 0 ? totalValor / totalGalones : 0,
                        porcentajeSinHorometro: numTanqueos > 0 ? (sinHorometro / numTanqueos) * 100 : 0
                    },
                    porCombustible,
                    costoPorArea
                },
                consumptionOverTime: Object.values(consumptionTime),
                fuelDistribution: fuelDistResult,
                byArea: Object.values(byArea),
                topVehicles: topVehiclesResult,
                alerts,
                saldosBombas: {
                    bombas,
                    stats: {
                        totalBombas: bombas.length,
                        totalSaldo: totalSaldoBombas,
                        numNegativos
                    }
                }
            });
        } catch (error) {
            console.error('Error en getFullData:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
