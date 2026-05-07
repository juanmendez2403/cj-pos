/**
 * CJ POS - Rutas de Productos
 * CRUD completo y gestión de recetas/ingredientes
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * GET /api/productos
 * Obtiene todos los productos activos con su categoría
 * Opcionalmente filtra por categoría con ?categoria=hamburguesas
 */
router.get('/', async (req, res) => {
    try {
        const { categoria } = req.query;
        let query = 'SELECT * FROM productos WHERE activo = TRUE';
        const params = [];

        if (categoria) {
            query += ' AND categoria = ?';
            params.push(categoria);
        }

        query += ' ORDER BY categoria, nombre';
        const [productos] = await pool.query(query, params);
        res.json({ success: true, data: productos });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener productos' });
    }
});

/**
 * POST /api/productos
 * Crear un nuevo producto
 */
router.post('/', async (req, res) => {
    try {
        const { nombre, descripcion, precio_venta, categoria } = req.body;

        if (!nombre || !precio_venta) {
            return res.status(400).json({ success: false, error: 'Nombre y precio son obligatorios' });
        }

        const [result] = await pool.query(`
            INSERT INTO productos (nombre, descripcion, precio_venta, categoria)
            VALUES (?, ?, ?, ?)
        `, [nombre, descripcion || null, precio_venta, categoria || 'hamburguesas']);

        const [nuevo] = await pool.query('SELECT * FROM productos WHERE id = ?', [result.insertId]);
        res.json({ success: true, data: nuevo[0], mensaje: 'Producto creado exitosamente' });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: 'Error al crear producto' });
    }
});

/**
 * PUT /api/productos/:id
 * Actualizar un producto existente
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, precio_venta, categoria, activo } = req.body;

        const campos = [];
        const valores = [];

        if (nombre !== undefined) { campos.push('nombre = ?'); valores.push(nombre); }
        if (descripcion !== undefined) { campos.push('descripcion = ?'); valores.push(descripcion); }
        if (precio_venta !== undefined) { campos.push('precio_venta = ?'); valores.push(precio_venta); }
        if (categoria !== undefined) { campos.push('categoria = ?'); valores.push(categoria); }
        if (activo !== undefined) { campos.push('activo = ?'); valores.push(activo); }

        if (campos.length === 0) {
            return res.status(400).json({ success: false, error: 'No se proporcionaron campos para actualizar' });
        }

        valores.push(id);
        await pool.query(`UPDATE productos SET ${campos.join(', ')} WHERE id = ?`, valores);

        const [updated] = await pool.query('SELECT * FROM productos WHERE id = ?', [id]);
        res.json({ success: true, data: updated[0], mensaje: 'Producto actualizado' });
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar producto' });
    }
});

/**
 * DELETE /api/productos/:id
 * Desactivar un producto (soft delete)
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('UPDATE productos SET activo = FALSE WHERE id = ?', [id]);
        res.json({ success: true, mensaje: 'Producto eliminado' });
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar producto' });
    }
});

// ==========================================
// RUTAS DE RECETAS / INGREDIENTES
// ==========================================

/**
 * GET /api/productos/:id/receta
 * Obtiene los ingredientes de un producto
 */
router.get('/:id/receta', async (req, res) => {
    try {
        const { id } = req.params;
        const [receta] = await pool.query(`
            SELECT r.*, i.nombre AS insumo_nombre, i.unidad_medida, i.stock_actual
            FROM recetas r
            JOIN insumos i ON r.insumo_id = i.id
            WHERE r.producto_id = ?
            ORDER BY i.nombre
        `, [id]);
        res.json({ success: true, data: receta });
    } catch (error) {
        console.error('Error al obtener receta:', error);
        res.status(500).json({ success: false, error: 'Error al obtener receta' });
    }
});

/**
 * POST /api/productos/:id/receta
 * Agregar un ingrediente a la receta del producto
 */
router.post('/:id/receta', async (req, res) => {
    try {
        const { id } = req.params;
        const { insumo_id, cantidad_necesaria } = req.body;

        if (!insumo_id || !cantidad_necesaria) {
            return res.status(400).json({ success: false, error: 'Insumo y cantidad son obligatorios' });
        }

        await pool.query(`
            INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE cantidad_necesaria = VALUES(cantidad_necesaria)
        `, [id, insumo_id, cantidad_necesaria]);

        res.json({ success: true, mensaje: 'Ingrediente agregado a la receta' });
    } catch (error) {
        console.error('Error al agregar ingrediente:', error);
        res.status(500).json({ success: false, error: 'Error al agregar ingrediente' });
    }
});

/**
 * PUT /api/productos/:id/receta/:insumoId
 * Actualizar la cantidad de un ingrediente en la receta
 */
router.put('/:id/receta/:insumoId', async (req, res) => {
    try {
        const { id, insumoId } = req.params;
        const { cantidad_necesaria } = req.body;

        if (!cantidad_necesaria || cantidad_necesaria <= 0) {
            return res.status(400).json({ success: false, error: 'Cantidad inválida' });
        }

        await pool.query(`
            UPDATE recetas SET cantidad_necesaria = ?
            WHERE producto_id = ? AND insumo_id = ?
        `, [cantidad_necesaria, id, insumoId]);

        res.json({ success: true, mensaje: 'Cantidad actualizada' });
    } catch (error) {
        console.error('Error al actualizar ingrediente:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar ingrediente' });
    }
});

/**
 * DELETE /api/productos/:id/receta/:insumoId
 * Quitar un ingrediente de la receta
 */
router.delete('/:id/receta/:insumoId', async (req, res) => {
    try {
        const { id, insumoId } = req.params;
        await pool.query(
            'DELETE FROM recetas WHERE producto_id = ? AND insumo_id = ?',
            [id, insumoId]
        );
        res.json({ success: true, mensaje: 'Ingrediente eliminado de la receta' });
    } catch (error) {
        console.error('Error al eliminar ingrediente:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar ingrediente' });
    }
});

/**
 * GET /api/productos/:id/disponibilidad
 * Verifica si hay suficientes insumos para preparar N unidades del producto
 * Query param: ?cantidad=1
 */
router.get('/:id/disponibilidad', async (req, res) => {
    try {
        const { id } = req.params;
        const cantidad = parseInt(req.query.cantidad) || 1;

        // Obtener la receta del producto con info del insumo
        const [receta] = await pool.query(`
            SELECT r.*, i.nombre AS insumo_nombre, i.stock_actual, i.unidad_medida
            FROM recetas r
            JOIN insumos i ON r.insumo_id = i.id
            WHERE r.producto_id = ?
        `, [id]);

        if (receta.length === 0) {
            return res.json({ success: true, disponible: false, mensaje: 'Producto sin receta configurada' });
        }

        // Verificar disponibilidad de cada insumo
        const faltantes = [];
        for (const item of receta) {
            const necesario = item.cantidad_necesaria * cantidad;
            if (item.stock_actual < necesario) {
                faltantes.push({
                    insumo: item.insumo_nombre,
                    disponible: parseFloat(item.stock_actual),
                    necesario: necesario,
                    unidad: item.unidad_medida
                });
            }
        }

        res.json({
            success: true,
            disponible: faltantes.length === 0,
            faltantes
        });
    } catch (error) {
        console.error('Error al verificar disponibilidad:', error);
        res.status(500).json({ success: false, error: 'Error al verificar disponibilidad' });
    }
});

/**
 * GET /api/productos/categorias
 * Lista las categorías disponibles
 */
router.get('/meta/categorias', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT DISTINCT categoria FROM productos WHERE activo = TRUE ORDER BY categoria'
        );
        res.json({ success: true, data: rows.map(r => r.categoria) });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener categorías' });
    }
});

module.exports = router;
