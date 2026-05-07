/**
 * CJ POS - Servidor Principal
 * Express.js con middleware y rutas configuradas
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos desde /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ==========================================
// RUTAS API
// ==========================================
app.use('/api/productos', require('./routes/productos'));
app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/setup', require('./routes/setup'));

// ==========================================
// RUTA CATCH-ALL (SPA)
// ==========================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ==========================================
// MANEJO GLOBAL DE ERRORES
// ==========================================
app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        detalle: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log('');
    console.log('🍔 ================================');
    console.log('🍔  CJ HAMBURGUESAS - POS System');
    console.log(`🍔  Servidor en http://localhost:${PORT}`);
    console.log('🍔 ================================');
    console.log('');
});
