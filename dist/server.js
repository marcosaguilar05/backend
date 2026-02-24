"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// IMPORTANTE: Cargar dotenv PRIMERO antes de otros imports
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const tanqueos_routes_1 = __importDefault(require("./routes/tanqueos.routes"));
const engrases_routes_1 = __importDefault(require("./routes/engrases.routes"));
const catalogos_routes_1 = __importDefault(require("./routes/catalogos.routes"));
const documentos_routes_1 = __importDefault(require("./routes/documentos.routes"));
const upload_routes_1 = __importDefault(require("./routes/upload.routes"));
const saldosBombas_routes_1 = __importDefault(require("./routes/saldosBombas.routes"));
const presupuestos_routes_1 = __importDefault(require("./routes/presupuestos.routes"));
const flota_routes_1 = __importDefault(require("./routes/flota.routes"));
const mantenimiento_routes_1 = __importDefault(require("./routes/mantenimiento.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*', // Permitir origen dinámico o todo si no está definido
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
// Log de todas las peticiones
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});
// Rutas
app.use('/api/auth', auth_routes_1.default);
app.use('/api/tanqueos', tanqueos_routes_1.default);
app.use('/api/engrases', engrases_routes_1.default);
app.use('/api/catalogos', catalogos_routes_1.default);
app.use('/api/documentos', documentos_routes_1.default);
app.use('/api/upload', upload_routes_1.default);
app.use('/api/saldos-bombas', saldosBombas_routes_1.default);
app.use('/api/presupuestos', presupuestos_routes_1.default);
app.use('/api/flota', flota_routes_1.default);
app.use('/api/mantenimiento', mantenimiento_routes_1.default);
// Ruta de prueba
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});
// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});
// Escuchar siempre (Railway provee PORT via env var)
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
exports.default = app;
