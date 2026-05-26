import { Response } from 'express';
import { AuthRequest } from '../types';
import { UserModel } from '../models/user.model';
import { PagoModel } from '../models/pagos.model';

export const pagosController = {
    async getAll(req: AuthRequest, res: Response) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                estadoPago = '',
                grupoRubro = '',
                rubro = '',
                subRubro = '',
                placa = '',
                sort_by = 'fecha',
                sort_order = 'desc'
            } = req.query;

            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skipNum = (pageNum - 1) * limitNum;

            const userEmail = req.user?.email;

            if (!userEmail) {
                return res.status(401).json({ error: 'Correo de usuario no disponible' });
            }

            // 1. Buscar al usuario en la base de datos externa de MongoDB
            const mongoUser = await UserModel.findOne({ email: userEmail });

            if (!mongoUser || mongoUser.activo === false) {
                console.log(`ℹ️ Usuario con correo ${userEmail} no registrado o inactivo en base de datos externa de pagos`);
                return res.json({
                    data: [],
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total: 0,
                        totalPages: 0
                    }
                });
            }

            // 2. Construir la consulta de pagos en MongoDB: dependencia TRANSPORTES y activo true
            const query: any = {
                dependencia: 'TRANSPORTES',
                activo: true
            };

            // Helper to apply multi-value filters in MongoDB
            const applyMongoFilter = (field: string, val: any) => {
                if (!val) return;
                const arr = String(val).split(',').map(s => s.trim()).filter(Boolean);
                if (arr.length > 0) {
                    query[field] = { $in: arr };
                }
            };

            // Filtro por estado de pago
            applyMongoFilter('estadoPago', estadoPago);

            // Filtro por grupo de rubro
            applyMongoFilter('grupoRubro', grupoRubro);

            // Filtro por rubro
            applyMongoFilter('rubro', rubro);

            // Filtro por subrubro
            applyMongoFilter('subRubro', subRubro);

            // Filtro por placa (vehículo)
            applyMongoFilter('placa', placa);

            // Filtro por término de búsqueda (concepto, tercero o placa)
            if (search) {
                const searchRegex = new RegExp(String(search), 'i');
                query.$or = [
                    { concepto: searchRegex },
                    { tercero: searchRegex },
                    { placa: searchRegex },
                    { consecutivo: searchRegex }
                ];
            }

            // 3. Ejecutar conteo, búsqueda y sumatorias en paralelo
            const sortOrderValue = sort_order === 'asc' ? 1 : -1;
            const sortByField = String(sort_by);

            const [total, data, totalsResult] = await Promise.all([
                PagoModel.countDocuments(query),
                PagoModel.find(query)
                    .sort({ [sortByField]: sortOrderValue })
                    .skip(skipNum)
                    .limit(limitNum)
                    .lean(),
                PagoModel.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalOperacion: { $sum: '$valorOperacion' },
                            totalNeto: { $sum: '$valorNeto' },
                            totalRetencion: { $sum: '$retencion' },
                            totalDescuento: { $sum: '$descuento' }
                        }
                    }
                ])
            ]);

            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: total || 0,
                    totalPages: Math.ceil((total || 0) / limitNum)
                },
                totals: totalsResult[0] || {
                    totalOperacion: 0,
                    totalNeto: 0,
                    totalRetencion: 0,
                    totalDescuento: 0
                }
            });
        } catch (error: any) {
            console.error('Error al obtener pagos desde MongoDB:', error);
            res.status(500).json({ error: error.message || 'Error interno del servidor' });
        }
    },

    async getFilters(req: AuthRequest, res: Response) {
        try {
            const userEmail = req.user?.email;

            if (!userEmail) {
                return res.status(401).json({ error: 'Correo de usuario no disponible' });
            }

            // Buscar al usuario en la base de datos externa de MongoDB
            const mongoUser = await UserModel.findOne({ email: userEmail });

            if (!mongoUser || mongoUser.activo === false) {
                return res.json({
                    grupos: [],
                    rubros: [],
                    subRubros: [],
                    placas: []
                });
            }

            const query = {
                dependencia: 'TRANSPORTES',
                activo: true
            };

            // Obtener valores distintos para poblar los filtros
            const [grupos, rubros, subRubros, placas] = await Promise.all([
                PagoModel.distinct('grupoRubro', query),
                PagoModel.distinct('rubro', query),
                PagoModel.distinct('subRubro', query),
                PagoModel.distinct('placa', query)
            ]);

            // Filtrar valores vacíos, nulos o indefinidos y ordenar alfabéticamente
            const cleanAndSort = (arr: any[]) => 
                arr.filter(item => item !== null && item !== undefined && item !== '').sort();

            res.json({
                grupos: cleanAndSort(grupos),
                rubros: cleanAndSort(rubros),
                subRubros: cleanAndSort(subRubros),
                placas: cleanAndSort(placas)
            });
        } catch (error: any) {
            console.error('Error al obtener filtros únicos desde MongoDB:', error);
            res.status(500).json({ error: error.message || 'Error interno del servidor' });
        }
    }
};
