"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.createAuthClient = createAuthClient;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables de entorno faltantes:');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
    console.error('   SUPABASE_ANON_KEY:', supabaseKey ? '✓' : '✗');
    throw new Error('SUPABASE_URL y SUPABASE_ANON_KEY deben estar definidos en .env');
}
// Cliente sin autenticación (solo para operaciones de auth)
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Función para crear cliente autenticado con token del usuario
// Esto permite que las políticas RLS se apliquen automáticamente
function createAuthClient(accessToken) {
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
}
