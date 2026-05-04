import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

// GET /horometro/agrupado — grouped by placa with summary stats
export const getAgrupado = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const placa = req.query.placa as string | undefined;

        // Fetch all horometro records with placa info
        let query = db
            .from('horometro')
            .select(`
                id, placa_id, tipo, km, hr, fecha_lectura,
                observaciones, hubo_reinicio_hr, hubo_reinicio_km,
                valor_hr_original, valor_km_original,
                last_reinicio_value_hr, last_reinicio_value_km,
                areas_placas!inner ( id, placa )
            `)
            .order('fecha_lectura', { ascending: false })
            .order('id', { ascending: false });

        if (placa) {
            query = query.ilike('areas_placas.placa', `%${placa}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Group by placa_id
        const grouped: Record<number, any> = {};
        for (const row of (data || [])) {
            const pid = row.placa_id!;
            if (!grouped[pid]) {
                const ap = row.areas_placas as any;
                grouped[pid] = {
                    placa_id: pid,
                    placa: ap?.placa || '-',
                    total_registros: 0,
                    ultimo_registro: null,
                    ultimo_valor_hr: null,
                    ultimo_valor_km: null,
                    tipo: null,
                    registros: []
                };
            }
            grouped[pid].total_registros++;
            grouped[pid].registros.push(row);
        }

        // Compute summary per group (first record is the latest due to ordering)
        const result = Object.values(grouped).map((g: any) => {
            const latest = g.registros[0];
            g.ultimo_registro = latest?.fecha_lectura || null;
            g.ultimo_valor_hr = latest?.hr || null;
            g.ultimo_valor_km = latest?.km || null;
            g.tipo = latest?.tipo || null;
            return g;
        });

        // Sort by ultimo_registro desc
        result.sort((a: any, b: any) => {
            if (!a.ultimo_registro) return 1;
            if (!b.ultimo_registro) return -1;
            return b.ultimo_registro.localeCompare(a.ultimo_registro);
        });

        res.json({ data: result, total: result.length });
    } catch (error) {
        console.error('Error fetching horometro agrupado:', error);
        next(error);
    }
};

// GET /horometro/detalle/:placa_id — all records for a specific placa
export const getDetalle = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { placa_id } = req.params;
        const db = req.supabase!;

        const { data, error } = await db
            .from('horometro')
            .select('*')
            .eq('placa_id', placa_id)
            .order('fecha_lectura', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching horometro detalle:', error);
        next(error);
    }
};

// POST /horometro — create a new record
export const createHorometro = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const db = req.supabase!;
        const body = req.body;

        const row: Record<string, any> = {
            placa_id: body.placa_id,
            fecha_lectura: body.fecha_lectura,
            hr: body.hr != null ? Number(body.hr) : null,
            km: body.km != null ? Number(body.km) : null,
            tipo: body.tipo || null,
            observaciones: body.observaciones || null,
            hubo_reinicio_hr: body.hubo_reinicio_hr || 'NO',
            hubo_reinicio_km: body.hubo_reinicio_km || 'NO',
            valor_hr_original: body.hr != null ? Number(body.hr) : null,
            valor_km_original: body.km != null ? Number(body.km) : null,
        };

        const { data, error } = await db
            .from('horometro')
            .insert(row)
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating horometro:', error);
        next(error);
    }
};

// DELETE /horometro/:id
export const deleteHorometro = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const db = req.supabase!;

        const { error } = await db
            .from('horometro')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting horometro:', error);
        next(error);
    }
};
