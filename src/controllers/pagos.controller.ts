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

            // Filtro por estado de pago
            if (estadoPago) {
                query.estadoPago = estadoPago;
            }

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

            // 3. Ejecutar conteo y búsqueda en paralelo
            const sortOrderValue = sort_order === 'asc' ? 1 : -1;
            const sortByField = String(sort_by);

            const [total, data] = await Promise.all([
                PagoModel.countDocuments(query),
                PagoModel.find(query)
                    .sort({ [sortByField]: sortOrderValue })
                    .skip(skipNum)
                    .limit(limitNum)
                    .lean()
            ]);

            res.json({
                data: data || [],
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: total || 0,
                    totalPages: Math.ceil((total || 0) / limitNum)
                }
            });
        } catch (error: any) {
            console.error('Error al obtener pagos desde MongoDB:', error);
            res.status(500).json({ error: error.message || 'Error interno del servidor' });
        }
    }
};
