/**
 * CJ POS - Rutas de Insumos (Inventario)
 * Gestión completa del inventario de ingredientes crudos
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/insumos
 * Lista todos los insumos con indicador de stock bajo
 */
router.get('/', async (req, res) => {
    try {
        const [insumos] = await pool.query(`
            SELECT *,
                CASE WHEN stock_actual <= stock_minimo THEN TRUE ELSE FALSE END AS stock_bajo
            FROM insumos
            WHERE activo = TRUE
            ORDER BY nombre
        `);
        res.json({ success: true, data: insumos });
    } catch (error) {
        console.error('Error al obtener insumos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener insumos' });
    }
});

/**
 * PUT /api/insumos/:id
 * Actualiza el stock y/o datos de un insumo
 * Body: { stock_actual, stock_minimo, costo_unitario, nombre }
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { stock_actual, stock_minimo, costo_unitario, nombre } = req.body;

        const campos = [];
        const valores = [];

        if (stock_actual !== undefined) { campos.push('stock_actual = ?'); valores.push(stock_actual); }
        if (stock_minimo !== undefined) { campos.push('stock_minimo = ?'); valores.push(stock_minimo); }
        if (costo_unitario !== undefined) { campos.push('costo_unitario = ?'); valores.push(costo_unitario); }
        if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }

        if (campos.length === 0) {
            return res.status(400).json({ success: false, error: 'No se proporcionaron campos para actualizar' });
        }

        valores.push(id);
        await pool.query(`UPDATE insumos SET ${campos.join(', ')} WHERE id = ?`, valores);

        const [updated] = await pool.query('SELECT * FROM insumos WHERE id = ?', [id]);
        res.json({ success: true, data: updated[0] });
    } catch (error) {
        console.error('Error al actualizar insumo:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar insumo' });
    }
});

/**
 * POST /api/insumos/:id/reabastecer
 * Agrega stock a un insumo existente
 * Body: { cantidad }
 */
router.post('/:id/reabastecer', async (req, res) => {
    try {
        const { id } = req.params;
        const { cantidad } = req.body;

        if (!cantidad || cantidad <= 0) {
            return res.status(400).json({ success: false, error: 'Cantidad inválida' });
        }

        await pool.query(
            'UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?',
            [cantidad, id]
        );

        const [updated] = await pool.query('SELECT * FROM insumos WHERE id = ?', [id]);
        res.json({ success: true, data: updated[0], mensaje: `Se agregaron ${cantidad} unidades` });
    } catch (error) {
        console.error('Error al reabastecer:', error);
        res.status(500).json({ success: false, error: 'Error al reabastecer insumo' });
    }
});

/**
 * GET /api/insumos/alertas
 * Devuelve solo los insumos con stock bajo
 */
router.get('/alertas/stock-bajo', async (req, res) => {
    try {
        const [alertas] = await pool.query(`
            SELECT * FROM insumos
            WHERE stock_actual <= stock_minimo AND activo = TRUE
            ORDER BY (stock_actual / stock_minimo) ASC
        `);
        res.json({ success: true, data: alertas, total: alertas.length });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener alertas' });
    }
});

module.exports = router;
