import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables de entorno faltantes:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
    throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY deben estar definidos en .env');
}

// Cliente sin autenticación (solo para operaciones de auth)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente admin con Service Role Key — bypasea RLS
// Usar SOLO para operaciones masivas de confianza (ej: importación batch)
export const adminSupabase = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false }
    })
    : supabase; // fallback al anon si no está configurado

// Función para crear cliente autenticado con token del usuario
// Esto permite que las políticas RLS se apliquen automáticamente
export function createAuthClient(accessToken: string): SupabaseClient {
    return createClient(supabaseUrl!, supabaseKey!, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
}