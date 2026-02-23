"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentosController = void 0;
const supabase_1 = require("../config/supabase");
exports.documentosController = {
    async getAll(req, res) {
        try {
            const { page = 1, limit = 20, placa, area_operacion, sort_by = 'fecha_vencimiento_soat', sort_order = 'asc' } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;
            // Build query
            let query = supabase_1.supabase
                .from('documentos_vehiculos_relaciones')
                .select('*', { count: 'exact' });
            // Filters
            if (placa) {
                query = query.ilike('placa', `%${placa}%`);
            }
            if (area_operacion) {
                query = query.ilike('area_operacion', `%${area_operacion}%`);
            }
            // Sorting
            const ascending = sort_order === 'asc';
            query = query.order(sort_by, { ascending }).order('id', { ascending: false });
            // Pagination
            query = query.range(offset, offset + limitNum - 1);
            const { data, error, count } = await query;
            if (error)
                throw error;
            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
        }
        catch (error) {
            console.error('Error fetching documentos:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async getById(req, res) {
        try {
            const { id } = req.params;
            const { data, error } = await supabase_1.supabase
                .from('documentos_vehiculos_relaciones')
                .select('*')
                .eq('id', id)
                .single();
            if (error)
                throw error;
            if (!data) {
                return res.status(404).json({ error: 'Documento no encontrado' });
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error fetching documento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async getFilterOptions(req, res) {
        try {
            // Fetch unique placas
            const { data: placasData } = await supabase_1.supabase
                .from('documentos_vehiculos_relaciones')
                .select('placa')
                .order('placa');
            const placas = [...new Set(placasData?.map(p => p.placa).filter(Boolean))];
            // Fetch unique areas
            const { data: areasData } = await supabase_1.supabase
                .from('documentos_vehiculos_relaciones')
                .select('area_operacion')
                .order('area_operacion');
            const areas_operacion = [...new Set(areasData?.map(a => a.area_operacion).filter(Boolean))];
            res.json({ placas, areas_operacion });
        }
        catch (error) {
            console.error('Error fetching filter options:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async create(req, res) {
        try {
            const documentoData = req.body;
            const { data, error } = await supabase_1.supabase
                .from('documentos_vehiculos')
                .insert(documentoData)
                .select()
                .single();
            if (error)
                throw error;
            res.status(201).json(data);
        }
        catch (error) {
            console.error('Error creating documento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const { data, error } = await supabase_1.supabase
                .from('documentos_vehiculos')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (error)
                throw error;
            res.json(data);
        }
        catch (error) {
            console.error('Error updating documento:', error);
            res.status(500).json({ error: error.message });
        }
    },
    async delete(req, res) {
        try {
            const { id } = req.params;
            const { error } = await supabase_1.supabase
                .from('documentos_vehiculos')
                .delete()
                .eq('id', id);
            if (error)
                throw error;
            res.status(204).send();
        }
        catch (error) {
            console.error('Error deleting documento:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
