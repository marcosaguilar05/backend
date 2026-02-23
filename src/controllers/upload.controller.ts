import { Request, Response } from 'express';
import multer from 'multer';
import { supabase } from '../config/supabase';

// Configurar multer para almacenar en memoria
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos PDF'));
        }
    }
});

export const uploadController = {
    async uploadDocument(req: Request, res: Response) {
        try {
            const file = req.file;
            const { folder, placa } = req.body;

            if (!file) {
                return res.status(400).json({ error: 'No se proporcionó archivo' });
            }

            if (!folder || !placa) {
                return res.status(400).json({ error: 'Folder y placa son requeridos' });
            }

            // Validar folder permitidos
            const allowedFolders = ['soat', 'rtm', 'polizas', 'tarjeta_propiedad'];
            if (!allowedFolders.includes(folder)) {
                return res.status(400).json({ error: 'Folder no válido' });
            }

            // Generar nombre de archivo
            const year = new Date().getFullYear();
            const cleanPlaca = placa.replace(/[^a-zA-Z0-9-]/g, '');
            const fileName = `${cleanPlaca}_${year}.pdf`;
            const filePath = `${folder}/${fileName}`;

            // Subir a Supabase Storage
            const { data, error } = await supabase.storage
                .from('vehiculos_docs')
                .upload(filePath, file.buffer, {
                    contentType: 'application/pdf',
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                console.error('Error uploading to Supabase:', error);
                return res.status(500).json({ error: error.message });
            }

            res.json({
                path: data.path,
                message: 'Archivo subido correctamente'
            });
        } catch (error: any) {
            console.error('Error in uploadDocument:', error);
            res.status(500).json({ error: error.message });
        }
    },

    async deleteDocument(req: Request, res: Response) {
        try {
            const { path } = req.body;

            if (!path) {
                return res.status(400).json({ error: 'Path es requerido' });
            }

            const { error } = await supabase.storage
                .from('vehiculos_docs')
                .remove([path]);

            if (error) {
                console.error('Error deleting from Supabase:', error);
                return res.status(500).json({ error: error.message });
            }

            res.json({ message: 'Archivo eliminado correctamente' });
        } catch (error: any) {
            console.error('Error in deleteDocument:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
