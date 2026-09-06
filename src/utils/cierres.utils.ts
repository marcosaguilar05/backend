import { supabase, adminSupabase } from '../config/supabase';

/**
 * Verifica si un mes determinado se encuentra cerrado contablemente
 * buscando si existen registros con 'estado_De_Cierre' = 'CERRADO' en ese mes.
 */
export async function isMonthClosed(
    dbClient: any,
    table: 'tanqueo' | 'engrase',
    fechaStr: string
): Promise<boolean> {
    if (!fechaStr) return false;
    const datePart = fechaStr.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length < 2) return false;

    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(y) || isNaN(m)) return false;

    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const client = (process.env.SUPABASE_SERVICE_ROLE_KEY ? adminSupabase : null) || dbClient || supabase;

    let query = client
        .from(table)
        .select('id')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .ilike('estado_De_Cierre', 'CERRADO')
        .limit(1);

    if (table === 'engrase') {
        query = query.is('eliminado_en', null);
    }

    const { data, error } = await query;
    if (error) {
        console.error(`Error verificando mes cerrado para ${table}:`, error);
        return false;
    }
    return !!data && data.length > 0;
}
