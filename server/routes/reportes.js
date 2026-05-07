/**
 * CJ POS - Rutas de Reportes
 * Reportes diarios de ventas y desglose por método de pago
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/reportes/diario
 * Reporte del día actual (o de una fecha específica con ?fecha=2026-05-02)
 */
router.get('/diario', async (req, res) => {
    try {
        const fecha = req.query.fecha || new Date().toISOString().slice(0, 10);

        // Resumen general del día
        const [resumen] = await pool.query(`
            SELECT
                COUNT(*) AS total_ventas,
                COALESCE(SUM(total), 0) AS ingresos_totales,
                COALESCE(SUM(subtotal), 0) AS subtotal_total,
                COALESCE(SUM(impuesto), 0) AS impuestos_total,
                COALESCE(AVG(total), 0) AS ticket_promedio
            FROM ventas
            WHERE DATE(fecha) = ? AND estado = 'completada'
        `, [fecha]);

        // Desglose por método de pago
        const [porMetodoPago] = await pool.query(`
            SELECT
                metodo_pago,
                COUNT(*) AS cantidad,
                SUM(total) AS total
            FROM ventas
            WHERE DATE(fecha) = ? AND estado = 'completada'
            GROUP BY metodo_pago
            ORDER BY total DESC
        `, [fecha]);

        // Productos más vendidos del día
        const [topProductos] = await pool.query(`
            SELECT
                p.nombre,
                SUM(dv.cantidad) AS cantidad_vendida,
                SUM(dv.subtotal) AS ingresos
            FROM detalles_ventas dv
            JOIN ventas v ON dv.venta_id = v.id
            JOIN productos p ON dv.producto_id = p.id
            WHERE DATE(v.fecha) = ? AND v.estado = 'completada'
            GROUP BY p.id, p.nombre
            ORDER BY cantidad_vendida DESC
            LIMIT 10
        `, [fecha]);

        // Ventas por hora
        const [ventasPorHora] = await pool.query(`
            SELECT
                HOUR(fecha) AS hora,
                COUNT(*) AS cantidad,
                SUM(total) AS total
            FROM ventas
            WHERE DATE(fecha) = ? AND estado = 'completada'
            GROUP BY HOUR(fecha)
            ORDER BY hora
        `, [fecha]);

        res.json({
            success: true,
            data: {
                fecha,
                resumen: resumen[0],
                porMetodoPago,
                topProductos,
                ventasPorHora
            }
        });
    } catch (error) {
        console.error('Error al generar reporte:', error);
        res.status(500).json({ success: false, error: 'Error al generar reporte' });
    }
});

module.exports = router;
