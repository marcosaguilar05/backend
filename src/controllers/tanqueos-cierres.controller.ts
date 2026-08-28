import { Response } from 'express';
import { supabase, adminSupabase } from '../config/supabase';
import { AuthRequest } from '../types';

export const tanqueosCierresController = {
    // Obtener resumen de meses con estado de cierre
    async getMonthlySummary(req: AuthRequest, res: Response): Promise<void> {
        try {
            const dbClient = adminSupabase || req.supabase || supabase;

            // Consultar fecha, valor_tanqueo, valor_anticipo, cantidad_galones y estado_De_Cierre
            const { data, error } = await dbClient
                .from('tanqueo')
                .select('fecha, valor_tanqueo, valor_anticipo, cantidad_galones, "estado_De_Cierre"');

            if (error) {
                console.error('Error al obtener resumen de cierres:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            // Agrupar por año-mes
            const monthlyMap: {
                [key: string]: {
                    periodo: string; // 'YYYY-MM'
                    year: number;
                    month: number;
                    total_registros: number;
                    total_cerrados: number;
                    total_abiertos: number;
                    total_galones: number;
                    total_valor: number;
                    estado: 'CERRADO' | 'ABIERTO' | 'PARCIAL';
                }
            } = {};

            (data || []).forEach((row: any) => {
                if (!row.fecha) return;
                const datePart = row.fecha.split('T')[0];
                const parts = datePart.split('-');
                if (parts.length < 2) return;

                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const periodo = `${year}-${String(month).padStart(2, '0')}`;

                if (!monthlyMap[periodo]) {
                    monthlyMap[periodo] = {
                        periodo,
                        year,
                        month,
                        total_registros: 0,
                        total_cerrados: 0,
                        total_abiertos: 0,
                        total_galones: 0,
                        total_valor: 0,
                        estado: 'ABIERTO'
                    };
                }

                const entry = monthlyMap[periodo];
                entry.total_registros += 1;

                const isCerrado = row.estado_De_Cierre && String(row.estado_De_Cierre).toUpperCase() === 'CERRADO';
                if (isCerrado) {
                    entry.total_cerrados += 1;
                } else {
                    entry.total_abiertos += 1;
                }

                entry.total_galones += Number(row.cantidad_galones || 0);
                entry.total_valor += Number(row.valor_tanqueo || row.valor_anticipo || 0);
            });

            // Determinar estado general de cada mes y ordenar de más reciente a más antiguo
            const summary = Object.values(monthlyMap)
                .map((m) => {
                    if (m.total_cerrados === m.total_registros && m.total_registros > 0) {
                        m.estado = 'CERRADO';
                    } else if (m.total_cerrados > 0) {
                        m.estado = 'PARCIAL';
                    } else {
                        m.estado = 'ABIERTO';
                    }
                    return m;
                })
                .sort((a, b) => b.periodo.localeCompare(a.periodo));

            res.json({
                data: summary,
                canManageCierres: !!req.user?.isCierreAdmin
            });
        } catch (error) {
            console.error('Error en getMonthlySummary:', error);
            res.status(500).json({ error: 'Error en el servidor al consultar cierres' });
        }
    },

    // Cerrar un mes completo
    async closeMonth(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.isCierreAdmin) {
                res.status(403).json({ error: 'No tienes permisos de Administrador de Cierres para realizar esta acción.' });
                return;
            }

            const { year, month } = req.body;
            if (!year || !month) {
                res.status(400).json({ error: 'Se requiere año y mes válidos.' });
                return;
            }

            const y = parseInt(year);
            const m = parseInt(month);
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            // Último día del mes
            const lastDay = new Date(y, m, 0).getDate();
            const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const dbClient = adminSupabase || req.supabase || supabase;

            const { data, error } = await dbClient
                .from('tanqueo')
                .update({
                    "estado_De_Cierre": 'CERRADO',
                    actualizado_por: req.user.id,
                    actualizado_en: new Date().toISOString()
                })
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .select('id');

            if (error) {
                console.error('Error al cerrar mes:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({
                message: `Mes ${String(m).padStart(2, '0')}/${y} cerrado exitosamente.`,
                registrosAfectados: data?.length || 0
            });
        } catch (error) {
            console.error('Error en closeMonth:', error);
            res.status(500).json({ error: 'Error en el servidor al cerrar mes' });
        }
    },

    // Reabrir un mes completo
    async reopenMonth(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.isCierreAdmin) {
                res.status(403).json({ error: 'No tienes permisos de Administrador de Cierres para realizar esta acción.' });
                return;
            }

            const { year, month } = req.body;
            if (!year || !month) {
                res.status(400).json({ error: 'Se requiere año y mes válidos.' });
                return;
            }

            const y = parseInt(year);
            const m = parseInt(month);
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const dbClient = adminSupabase || req.supabase || supabase;

            const { data, error } = await dbClient
                .from('tanqueo')
                .update({
                    "estado_De_Cierre": null,
                    actualizado_por: req.user.id,
                    actualizado_en: new Date().toISOString()
                })
                .gte('fecha', startDate)
                .lte('fecha', endDate)
                .select('id');

            if (error) {
                console.error('Error al reabrir mes:', error);
                res.status(400).json({ error: error.message });
                return;
            }

            res.json({
                message: `Mes ${String(m).padStart(2, '0')}/${y} reabierto exitosamente.`,
                registrosAfectados: data?.length || 0
            });
        } catch (error) {
            console.error('Error en reopenMonth:', error);
            res.status(500).json({ error: 'Error en el servidor al reabrir mes' });
        }
    }
};
