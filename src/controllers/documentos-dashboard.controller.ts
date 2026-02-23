import { Response } from 'express';
import { supabase } from '../config/supabase';
import { AuthRequest } from '../types';

// Función para calcular estado basado en días restantes
function getDocumentStatus(fechaVencimiento: string | null): { estado: string; diasRestantes: number; color: string } {
    if (!fechaVencimiento) {
        return { estado: 'SIN_FECHA', diasRestantes: -9999, color: 'slate' };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(fechaVencimiento);
    vencimiento.setHours(0, 0, 0, 0);

    const diffTime = vencimiento.getTime() - hoy.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) {
        return { estado: 'VENCIDO', diasRestantes, color: 'red' };
    } else if (diasRestantes <= 30) {
        return { estado: 'POR_VENCER', diasRestantes, color: 'orange' };
    } else if (diasRestantes <= 60) {
        return { estado: 'PROXIMO', diasRestantes, color: 'yellow' };
    } else {
        return { estado: 'VIGENTE', diasRestantes, color: 'green' };
    }
}

export const documentosDashboardController = {
    // KPIs Ejecutivos
    async getKPIs(req: AuthRequest, res: Response): Promise<void> {
        try {
            const placa = req.query.placa as string;
            const area_operacion = req.query.area_operacion as string;

            let query = supabase.from('documentos_vehiculos_relaciones').select('*');

            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            let vencidos = 0, porVencer = 0, proximos = 0, vigentes = 0, sinDocumento = 0;
            let totalVehiculos = data?.length || 0;

            const documentTypes = ['fecha_vencimiento_soat', 'fecha_vencimiento_rtm', 'fecha_vencimiento_poliza'];

            data?.forEach(row => {
                documentTypes.forEach(docType => {
                    const fecha = row[docType];
                    if (!fecha) {
                        sinDocumento++;
                        return;
                    }
                    const { estado } = getDocumentStatus(fecha);
                    switch (estado) {
                        case 'VENCIDO': vencidos++; break;
                        case 'POR_VENCER': porVencer++; break;
                        case 'PROXIMO': proximos++; break;
                        case 'VIGENTE': vigentes++; break;
                    }
                });
            });

            res.json({
                totalVehiculos,
                vencidos,
                porVencer,
                proximos,
                vigentes,
                sinDocumento,
                totalDocumentos: vencidos + porVencer + proximos + vigentes
            });
        } catch (error) {
            console.error('Error en getKPIs documentos:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Eventos para calendario
    async getCalendarEvents(req: AuthRequest, res: Response): Promise<void> {
        try {
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
            const placa = req.query.placa as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_documento = req.query.tipo_documento as string;

            let query = supabase.from('documentos_vehiculos_relaciones')
                .select('id, placa, area_operacion, fecha_vencimiento_soat, fecha_vencimiento_rtm, fecha_vencimiento_poliza, pdf_soat, pdf_rtm, pdf_poliza');

            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const events: any[] = [];
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0);

            // Extender rango para incluir eventos cercanos
            startOfMonth.setDate(startOfMonth.getDate() - 7);
            endOfMonth.setDate(endOfMonth.getDate() + 7);

            const documentTypes = [
                { key: 'fecha_vencimiento_soat', label: 'SOAT', pdfKey: 'pdf_soat' },
                { key: 'fecha_vencimiento_rtm', label: 'RTM', pdfKey: 'pdf_rtm' },
                { key: 'fecha_vencimiento_poliza', label: 'Póliza', pdfKey: 'pdf_poliza' }
            ];

            data?.forEach((row: any) => {
                documentTypes.forEach(docType => {
                    // Filtrar por tipo si está especificado
                    if (tipo_documento && tipo_documento !== docType.label) return;

                    const fecha = row[docType.key];
                    if (!fecha) return;

                    const fechaDate = new Date(fecha);
                    if (fechaDate < startOfMonth || fechaDate > endOfMonth) return;

                    const { estado, diasRestantes, color } = getDocumentStatus(fecha);

                    events.push({
                        id: `${row.id}-${docType.key}`,
                        placa: row.placa,
                        area_operacion: row.area_operacion,
                        tipo_documento: docType.label,
                        fecha: fecha,
                        estado,
                        diasRestantes,
                        color,
                        pdf: row[docType.pdfKey] || null
                    });
                });
            });

            // Ordenar por fecha
            events.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

            res.json(events);
        } catch (error) {
            console.error('Error en getCalendarEvents:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Lista de documentos próximos a vencer
    async getExpiringList(req: AuthRequest, res: Response): Promise<void> {
        try {
            const placa = req.query.placa as string;
            const area_operacion = req.query.area_operacion as string;
            const tipo_documento = req.query.tipo_documento as string;
            const estado_filter = req.query.estado as string;
            const limit = parseInt(req.query.limit as string) || 50;

            let query = supabase.from('documentos_vehiculos_relaciones')
                .select('id, placa, area_operacion, fecha_vencimiento_soat, fecha_vencimiento_rtm, fecha_vencimiento_poliza, pdf_soat, pdf_rtm, pdf_poliza');

            if (placa) query = query.ilike('placa', `%${placa}%`);
            if (area_operacion) query = query.ilike('area_operacion', `%${area_operacion}%`);

            const { data, error } = await query;

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const items: any[] = [];

            const documentTypes = [
                { key: 'fecha_vencimiento_soat', label: 'SOAT', pdfKey: 'pdf_soat' },
                { key: 'fecha_vencimiento_rtm', label: 'RTM', pdfKey: 'pdf_rtm' },
                { key: 'fecha_vencimiento_poliza', label: 'Póliza', pdfKey: 'pdf_poliza' }
            ];

            data?.forEach((row: any) => {
                documentTypes.forEach(docType => {
                    // Filtrar por tipo si está especificado
                    if (tipo_documento && tipo_documento !== docType.label) return;

                    const fecha = row[docType.key];
                    if (!fecha) return;

                    const { estado, diasRestantes, color } = getDocumentStatus(fecha);

                    // Filtrar por estado si está especificado
                    if (estado_filter && estado_filter !== estado) return;

                    items.push({
                        id: `${row.id}-${docType.key}`,
                        vehiculo_id: row.id,
                        placa: row.placa,
                        area_operacion: row.area_operacion,
                        tipo_documento: docType.label,
                        fecha_vencimiento: fecha,
                        estado,
                        diasRestantes,
                        color,
                        pdf: row[docType.pdfKey] || null
                    });
                });
            });

            // Ordenar por días restantes (prioridad: vencidos primero, luego próximos)
            items.sort((a, b) => a.diasRestantes - b.diasRestantes);

            res.json(items.slice(0, limit));
        } catch (error) {
            console.error('Error en getExpiringList:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    },

    // Distribución por área
    async getByArea(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { data, error } = await supabase
                .from('documentos_vehiculos_relaciones')
                .select('area_operacion, fecha_vencimiento_soat, fecha_vencimiento_rtm, fecha_vencimiento_poliza');

            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }

            const byArea: Record<string, { area: string; total: number; vencidos: number; porVencer: number; proximos: number; vigentes: number }> = {};

            const documentTypes = ['fecha_vencimiento_soat', 'fecha_vencimiento_rtm', 'fecha_vencimiento_poliza'];

            data?.forEach((row: any) => {
                const area = row.area_operacion || 'SIN ÁREA';
                if (!byArea[area]) {
                    byArea[area] = { area, total: 0, vencidos: 0, porVencer: 0, proximos: 0, vigentes: 0 };
                }

                documentTypes.forEach(docType => {
                    const fecha = row[docType];
                    if (!fecha) return;

                    byArea[area].total++;
                    const { estado } = getDocumentStatus(fecha);
                    switch (estado) {
                        case 'VENCIDO': byArea[area].vencidos++; break;
                        case 'POR_VENCER': byArea[area].porVencer++; break;
                        case 'PROXIMO': byArea[area].proximos++; break;
                        case 'VIGENTE': byArea[area].vigentes++; break;
                    }
                });
            });

            const result = Object.values(byArea).sort((a, b) =>
                (b.vencidos + b.porVencer) - (a.vencidos + a.porVencer)
            );

            res.json(result);
        } catch (error) {
            console.error('Error en getByArea:', error);
            res.status(500).json({ error: 'Error en el servidor' });
        }
    }
};
