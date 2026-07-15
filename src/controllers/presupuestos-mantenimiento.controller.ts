import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

export const presupuestosMantenimientoController = {
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

            if (vehiculo_id) query = query.eq('vehiculo_id', Number(vehiculo_id));
            if (anio && anio !== 'undefined' && anio !== '') query = query.eq('anio', Number(anio));
            
            // Text search simple for q
            if (q && q !== 'undefined' && q !== '') {
                const searchTerm = `%${String(q).trim()}%`;
                // Simplified text search across nota
                query = query.ilike('nota', searchTerm);
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
                
            if (vehiculo_id) summaryQuery = summaryQuery.eq('vehiculo_id', Number(vehiculo_id));
            if (anio && anio !== 'undefined' && anio !== '') summaryQuery = summaryQuery.eq('anio', Number(anio));
            
            if (q && q !== 'undefined' && q !== '') {
                const searchTerm = `%${String(q).trim()}%`;
                summaryQuery = summaryQuery.ilike('nota', searchTerm);
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
                    totalEjecutadoReal: totalEjecutado, // No mongodb sync for now
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
                    grupo:rubros!presupuesto_unificado_grupo_rubro_id_fkey(*),
                    rubro:rubros!presupuesto_unificado_rubro_id_fkey(*),
                    personal:tipos_personal(*),
                    tipo:conceptos_presupuesto!presupuesto_unificado_tipo_presupuesto_id_fkey(*),
                    concepto:conceptos_presupuesto!presupuesto_unificado_concepto_presupuesto_id_fkey(*)
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
