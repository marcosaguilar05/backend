import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

export const documentosController = {
    async getAll(req: AuthRequest, res: Response) {
        try {
            const {
                page = 1,
                limit = 20,
                placa,
                area_operacion,
                sort_by = 'fecha_vencimiento_soat',
                sort_order = 'asc'
            } = req.query;

            const pageNum = Number(page);
            const limitNum = Number(limit);
            const offset = (pageNum - 1) * limitNum;

            const applyFilter = (q: any, field: string, value: any) => {
                if (!value) return q;
                const arr = String(value).split(',').map(s => s.trim()).filter(Boolean);
                if (arr.length === 0) return q;
                return q.in(field, arr);
            };

            // Build query
            let query = (req.supabase || supabase)
                .from('documentos_vehiculos_relaciones')
                .select('*', { count: 'exact' });

            // Filters
            if (placa) query = applyFilter(query, 'placa', placa);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);

            // Sorting
            const ascending = sort_order === 'asc';
            query = query.order(sort_by as string, { ascending }).order('id', { ascending: false });

            // Pagination
            query = query.range(offset, offset + limitNum - 1);

            const { data, error, count } = await query;

            if (error) throw error;

            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count || 0,
                    totalPages: Math.ceil((count || 0) / limitNum)
                }
            });
        } catch (error: any) {
            console.error('Error fetching documentos:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getById(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const { data, error } = await (req.supabase || supabase)
                .from('documentos_vehiculos_relaciones')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) {
                return res.status(404).json({ error: 'Documento no encontrado' });
            }

            res.json(data);
        } catch (error: any) {
            console.error('Error fetching documento:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async getFilterOptions(req: AuthRequest, res: Response) {
        try {
            // Fetch unique placas
            const { data: placasData } = await (req.supabase || supabase)
                .from('documentos_vehiculos_relaciones')
                .select('placa')
                .order('placa');

            const placas = [...new Set(placasData?.map(p => p.placa).filter(Boolean))];

            // Fetch unique areas
            const { data: areasData } = await (req.supabase || supabase)
                .from('documentos_vehiculos_relaciones')
                .select('area_operacion')
                .order('area_operacion');

            const areas_operacion = [...new Set(areasData?.map(a => a.area_operacion).filter(Boolean))];

            res.json({ placas, areas_operacion });
        } catch (error: any) {
            console.error('Error fetching filter options:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async create(req: AuthRequest, res: Response) {
        try {
            const documentoData = req.body;

            const { data, error } = await (req.supabase || supabase)
                .from('documentos_vehiculos')
                .insert(documentoData)
                .select()
                .single();

            if (error) throw error;

            res.status(201).json(data);
        } catch (error: any) {
            console.error('Error creating documento:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async update(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const { data, error } = await (req.supabase || supabase)
                .from('documentos_vehiculos')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json(data);
        } catch (error: any) {
            console.error('Error updating documento:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async delete(req: AuthRequest, res: Response) {
        try {
            const { id } = req.params;

            const { error } = await (req.supabase || supabase)
                .from('documentos_vehiculos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            res.status(204).send();
        } catch (error: any) {
            console.error('Error deleting documento:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async deleteBatch(req: AuthRequest, res: Response) {
        try {
            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({ error: 'No se enviaron IDs válidos para eliminar' });
            }

            const { error } = await (req.supabase || supabase)
                .from('documentos_vehiculos')
                .delete()
                .in('id', ids);

            if (error) throw error;

            res.json({ message: `${ids.length} registros eliminados exitosamente` });
        } catch (error: any) {
            console.error('Error deleting batch documentos:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async exportZip(req: AuthRequest, res: Response) {
        try {
            const { ZipArchive } = require('archiver');
            const { Readable } = require('stream');

            const {
                placa,
                area_operacion
            } = req.query;

            const applyFilter = (q: any, field: string, value: any) => {
                if (!value) return q;
                const arr = String(value).split(',').map(s => s.trim()).filter(Boolean);
                if (arr.length === 0) return q;
                return q.in(field, arr);
            };

            // Build query for ALL matching records (no pagination)
            let query = (req.supabase || supabase)
                .from('documentos_vehiculos_relaciones')
                .select('*');

            if (placa) query = applyFilter(query, 'placa', placa);
            if (area_operacion) query = applyFilter(query, 'area_operacion', area_operacion);

            const { data, error } = await query;

            if (error) throw error;
            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'No hay documentos para exportar con estos filtros' });
            }

            const archive = new ZipArchive({
                zlib: { level: 5 } // Nivel de compresión balanceado
            });

            // Set headers para descargar ZIP
            const date = new Date().toISOString().split('T')[0];
            res.attachment(`Documentacion_Vehiculos_${date}.zip`);
            
            // Log warning si hay error, no romper flujo
            archive.on('warning', function(err: any) {
                if (err.code === 'ENOENT') {
                    console.warn(err);
                } else {
                    throw err;
                }
            });

            archive.on('error', function(err: any) {
                console.error('Archiver error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: err.message });
                }
            });

            // Pipe archive a la respuesta
            archive.pipe(res);

            const supabaseUrl = 'https://tbljsnqsjjapdeydokwh.supabase.co';
            
            const getFileStream = async (url: string) => {
                try {
                    const fullUrl = url.startsWith('http') ? url : `${supabaseUrl}/storage/v1/object/public/vehiculos_docs/${url}`;
                    const response = await fetch(fullUrl);
                    if (response.ok && response.body) {
                        return Readable.fromWeb(response.body);
                    }
                } catch (e) {
                    console.error('Error fetching file', url, e);
                }
                return null;
            };

            const sanitizeName = (name: string) => name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

            // Procesar documentos secuencialmente (o con un pool limitado)
            for (const doc of data) {
                const area = sanitizeName(doc.area_operacion || 'SIN_ASIGNAR');
                const placaFolder = sanitizeName(doc.placa || 'SIN_PLACA');
                
                const docsType = [
                    { key: 'pdf_soat', name: 'SOAT.pdf' },
                    { key: 'pdf_rtm', name: 'RTM.pdf' },
                    { key: 'pdf_poliza', name: 'POLIZA.pdf' },
                    { key: 'tarjeta_propiedad', name: 'TARJETA_PROPIEDAD.pdf' }
                ];

                for (const dt of docsType) {
                    const url = doc[dt.key];
                    if (url) {
                        const stream = await getFileStream(url);
                        if (stream) {
                            archive.append(stream, { name: `${area}/${placaFolder}/${dt.name}` });
                        }
                    }
                }
            }

            // Finalizar ZIP
            await archive.finalize();

        } catch (error: any) {
            console.error('Error exportando zip:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message });
            }
        }
    }
};
