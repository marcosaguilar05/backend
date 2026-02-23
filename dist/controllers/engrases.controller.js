"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.engrasesController = void 0;
const supabase_1 = require("../config/supabase");
// Caché simple en memoria para filter options (5 minutos)
let filterOptionsCache = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
exports.engrasesController = {
    // Obtener todos los engrases con paginación y filtros
    async getAll(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;
            // Filtros
            const conductor = req.query.conductor;
            const placa = req.query.placa;
            const area_operacion = req.query.area_operacion;
            const fecha_inicio = req.query.fecha_inicio;
            const fecha_fin = req.query.fecha_fin;
            // Query base
            let query = supabase_1.supabase
                .from('engrases_relaciones')
                .select('*', { count: 'exact' });
            // Aplicar filtros
            if (conductor) {
                query = query.ilike('conductor', `%${conductor}%`);
            }
            if (placa) {
                query = query.ilike('placa', `%${placa}%`);
            }
            if (area_operacion) {
                query = query.ilike('area_operacion', `%${area_operacion}%`);
            }
            if (fecha_inicio) {
                query = query.gte('fecha', fecha_inicio);
            }
            if (fecha_fin) {
                query = query.lte('fecha', fecha_fin);
            }
            // Ordenamiento
            const sort_by = req.query.sort_by || 'fecha';
            const sort_order = req.query.sort_order;
            const ascending = sort_order === 'asc';
            // Aplicar ordenamiento
            if (sort_order) {
                query = query.order(sort_by, { ascending }).order('id', { ascending: false });
            }
            else {
                query = query.order('fecha', { ascending: false }).order('id', { ascending: false });
            }
            const { data, error, count } = await query
                .range(offset, offset + limit - 1);
            if (error) {
                console.error('Error en getAll Engrases:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            res.json({
                data: data,
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            });
        }
        catch (error) {
            console.error('Error obteniendo engrases:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Obtener valores únicos para los filtros - Con RLS aplicado
    async getFilterOptions(req, res) {
        try {
            // Usar cliente autenticado para que RLS aplique automáticamente
            const dbClient = req.supabase || supabase_1.supabase;
            // Ejecutar queries en paralelo para mejorar rendimiento
            const [conductoresRes, placasRes, areasRes] = await Promise.all([
                dbClient.from('areas_conductores').select('conductor').order('conductor'),
                dbClient.from('areas_placas').select('placa').eq('estado', 'ACTIVADA').order('placa'),
                dbClient.from('areas_operacion').select('nombre').order('nombre')
            ]);
            // Extraer valores únicos
            const conductores = [...new Set(conductoresRes.data?.map(t => t.conductor))].filter(Boolean).sort();
            const placas = [...new Set(placasRes.data?.map(t => t.placa))].filter(Boolean).sort();
            const areas = [...new Set(areasRes.data?.map(t => t.nombre))].filter(Boolean).sort();
            const responseData = {
                conductores,
                placas,
                areas_operacion: areas
            };
            res.json(responseData);
        }
        catch (error) {
            console.error('Error obteniendo opciones de filtros engrases:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async getById(req, res) {
        try {
            const { id } = req.params;
            const { data, error } = await supabase_1.supabase
                .from('engrases_relaciones')
                .select('*')
                .eq('id', id)
                .single();
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error obteniendo engrase:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async create(req, res) {
        try {
            const engraseData = {
                fecha: req.body.fecha,
                conductor_id: parseInt(req.body.conductor_id),
                placa_id: parseInt(req.body.placa_id),
                area_operacion_id: parseInt(req.body.area_operacion_id),
                lavado: parseFloat(req.body.lavado) || 0,
                engrase: parseFloat(req.body.engrase) || 0,
                otros: parseFloat(req.body.otros) || 0,
                observaciones: req.body.observaciones || null,
                creado_por: req.user?.id,
                suma: (parseFloat(req.body.lavado) || 0) + (parseFloat(req.body.engrase) || 0) + (parseFloat(req.body.otros) || 0)
            };
            const { data, error } = await supabase_1.supabase
                .from('engrase')
                .insert([engraseData])
                .select();
            if (error) {
                console.error('Error en create engrase:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            res.status(201).json(data[0]);
        }
        catch (error) {
            console.error('Error creando engrase:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = {
                fecha: req.body.fecha,
                conductor_id: parseInt(req.body.conductor_id),
                placa_id: parseInt(req.body.placa_id),
                area_operacion_id: parseInt(req.body.area_operacion_id),
                lavado: parseFloat(req.body.lavado) || 0,
                engrase: parseFloat(req.body.engrase) || 0,
                otros: parseFloat(req.body.otros) || 0,
                observaciones: req.body.observaciones || null,
                actualizado_por: req.user?.id,
                actualizado_en: new Date().toISOString()
            };
            updateData.suma = (updateData.lavado || 0) + (updateData.engrase || 0) + (updateData.otros || 0);
            const { data, error } = await supabase_1.supabase
                .from('engrase')
                .update(updateData)
                .eq('id', id)
                .select();
            if (error) {
                console.error('Error en update engrase:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            if (!data || data.length === 0) {
                res.status(404).json({ error: 'Engrase no encontrado' });
                return;
            }
            res.json(data[0]);
        }
        catch (error) {
            console.error('Error actualizando engrase:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async delete(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase_1.supabase
                .from('engrase')
                .delete()
                .eq('id', id);
            if (error) {
                console.error('Error en delete engrase:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            res.json({ message: 'Engrase eliminado exitosamente' });
        }
        catch (error) {
            console.error('Error eliminando engrase:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async getFinancialReport(req, res) {
        try {
            const fecha_inicio = req.query.fecha_inicio;
            const fecha_fin = req.query.fecha_fin;
            // Otros filtros
            const conductor = req.query.conductor;
            const placa = req.query.placa;
            const area_operacion = req.query.area_operacion;
            let query = supabase_1.supabase.from('engrase_financiero').select('*');
            // Filtros de fecha ("Fecha de Creacion" segun estructura dada)
            if (fecha_inicio)
                query = query.gte('Fecha de Creacion', fecha_inicio);
            if (fecha_fin)
                query = query.lte('Fecha de Creacion', fecha_fin);
            // Mapeo de filtros a columnas de la vista financiera
            if (conductor)
                query = query.ilike('Responsable', `%${conductor}%`);
            if (placa)
                query = query.ilike('Placa', `%${placa}%`);
            if (area_operacion)
                query = query.ilike('Área de Operacion', `%${area_operacion}%`);
            query = query.order('Fecha de Creacion', { ascending: false });
            const { data, error } = await query;
            if (error) {
                console.error('Error fetching financial report engrases:', error);
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error fetching financial report engrases:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    async getExportData(req, res) {
        try {
            const conductor = req.query.conductor;
            const placa = req.query.placa;
            const area_operacion = req.query.area_operacion;
            const fecha_inicio = req.query.fecha_inicio;
            const fecha_fin = req.query.fecha_fin;
            let query = supabase_1.supabase.from('engrases_relaciones').select('*');
            if (conductor)
                query = query.ilike('conductor', `%${conductor}%`);
            if (placa)
                query = query.ilike('placa', `%${placa}%`);
            if (area_operacion)
                query = query.ilike('area_operacion', `%${area_operacion}%`);
            if (fecha_inicio)
                query = query.gte('fecha', fecha_inicio);
            if (fecha_fin)
                query = query.lte('fecha', fecha_fin);
            const { data, error } = await query.order('fecha', { ascending: false });
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            res.json(data);
        }
        catch (error) {
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },
    // Reusing logic for Dashboard link
    async getDashboardLink(req, res) {
        // Same logic as Tanqueos, checking user area
        try {
            const userId = req.user?.id;
            if (!userId) {
                res.status(401).json({ error: 'Usuario no autenticado' });
                return;
            }
            const { data: userData } = await supabase_1.supabase
                .from('usuarios')
                .select('area_operacion_id')
                .eq('id', userId)
                .single();
            const userAreaId = userData?.area_operacion_id || null;
            // In this case, user asked to check 'tableros' table again, specifically 'link_engrase' field from the example?
            // "usa la columna que dice solo 'link'" for tanqueos.
            // For engrases, the example JSON showed: "link_engrase":"https://..."
            // I should verify if I need to fetch 'link_engrase' instead of 'link'.
            // The user request said: "usa la columna que dice solo link" (referring to the previous dashboard task).
            // BUT in the example data in the PROMPT for this task:
            // "link":"https://...", "link_engrase":"https://..."
            // It strongly suggests I should use 'link_engrase' for this module.
            let query = supabase_1.supabase.from('tableros').select('link_engrase').limit(1);
            if (userAreaId) {
                const { data: specificBoard } = await supabase_1.supabase
                    .from('tableros')
                    .select('link_engrase')
                    .eq('area_operacion_id', userAreaId)
                    .single();
                if (specificBoard?.link_engrase) {
                    res.json({ link: specificBoard.link_engrase });
                    return;
                }
            }
            // Fallback
            const { data: defaultBoard, error: defaultError } = await supabase_1.supabase
                .from('tableros')
                .select('link_engrase')
                .is('area_operacion_id', null)
                .single();
            if (defaultError || !defaultBoard) {
                res.json({ link: null });
                return;
            }
            res.json({ link: defaultBoard.link_engrase });
        }
        catch (error) {
            console.error('Error link dashboard engrase:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
