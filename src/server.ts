import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import tanqueosRoutes from './routes/tanqueos.routes';
import engrasesRoutes from './routes/engrases.routes';
import documentosRoutes from './routes/documentos.routes';
import saldosBombasRoutes from './routes/saldosBombas.routes';
import flotaRoutes from './routes/flota.routes';
import presupuestosRoutes from './routes/presupuestos.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/tanqueos', tanqueosRoutes);
app.use('/api/engrases', engrasesRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/saldos-bombas', saldosBombasRoutes);
app.use('/api/flota', flotaRoutes);
app.use('/api/presupuestos', presupuestosRoutes);

// Ruta de salud
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

app.get('/', (req, res) => {
    res.send('API Backend is running 🚀');
});

export default app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
}