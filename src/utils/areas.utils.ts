import { SupabaseClient } from '@supabase/supabase-js';
import { supabase, adminSupabase } from '../config/supabase';

let deactivatedAreasCache: { ids: number[]; names: string[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000; // 30 segundos

/**
 * Obtiene los IDs y nombres de las áreas de operación desactivadas.
 */
export async function getDeactivatedAreas(dbClient?: SupabaseClient): Promise<{ ids: number[]; names: string[] }> {
    const now = Date.now();
    if (deactivatedAreasCache && (now - deactivatedAreasCache.timestamp) < CACHE_TTL) {
        return deactivatedAreasCache;
    }

    const client = (process.env.SUPABASE_SERVICE_ROLE_KEY ? adminSupabase : null) || dbClient || supabase;
    const { data, error } = await client
        .from('areas_operacion')
        .select('id, nombre')
        .eq('estado', 'DESACTIVADA');

    if (error || !data) {
        return { ids: [], names: [] };
    }

    const result = {
        ids: data.map((a: any) => a.id).filter(Boolean),
        names: data.map((a: any) => a.nombre).filter(Boolean),
        timestamp: now
    };

    deactivatedAreasCache = result;
    return result;
}

/**
 * Invalida la caché de áreas desactivadas al actualizar o crear áreas.
 */
export function clearDeactivatedAreasCache(): void {
    deactivatedAreasCache = null;
}

/**
 * Aplica el filtro para excluir registros de áreas desactivadas a una consulta de Supabase/PostgREST.
 */
export async function applyActiveAreasFilter(query: any, dbClient?: SupabaseClient): Promise<any> {
    const { ids } = await getDeactivatedAreas(dbClient);
    if (ids.length > 0) {
        return query.not('area_operacion_id', 'in', `(${ids.join(',')})`);
    }
    return query;
}
