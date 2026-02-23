import dotenv from 'dotenv';

// IMPORTANTE: Cargar dotenv PRIMERO antes de otros imports
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import tanqueosRoutes from './routes/tanqueos.routes';
import engrasesRoutes from './routes/engrases.routes';
import catalogosRoutes from './routes/catalogos.routes';
import documentosRoutes from './routes/documentos.routes';
import uploadRoutes from './routes/upload.routes';
import saldosBombasRoutes from './routes/saldosBombas.routes';
import presupuestosRoutes from './routes/presupuestos.routes';
import flotaRoutes from './routes/flota.routes';
import mantenimientoRoutes from './routes/mantenimiento.routes';

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Permitir origen dinámico o todo si no está definido
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Log de todas las peticiones
app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tanqueos', tanqueosRoutes);
app.use('/api/engrases', engrasesRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/saldos-bombas', saldosBombasRoutes);
app.use('/api/presupuestos', presupuestosRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/mantenimiento', mantenimientoRoutes);

// Ruta de prueba
app.get('/api/health', (req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Manejo de errores 404
app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Escuchar siempre (Railway provee PORT via env var)
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

export default app;