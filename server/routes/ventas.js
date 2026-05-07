/**
 * CJ POS - Rutas de Ventas
 * ============================================================
 * MÓDULO CRÍTICO: Procesamiento de ventas con TRANSACCIONES
 * 
 * Este módulo garantiza la integridad de datos mediante
 * transacciones SQL (BEGIN/COMMIT/ROLLBACK). Si cualquier paso
 * falla (ej: stock insuficiente), toda la operación se revierte.
 * ============================================================
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

/**
 * Genera un folio único para la venta
 * Formato: CJ-YYYYMMDD-NNN
 */
async function generarFolio(connection) {
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const [rows] = await connection.query(
        `SELECT COUNT(*) as total FROM ventas WHERE DATE(fecha) = CURDATE()`
    );
    const consecutivo = (rows[0].total + 1).toString().padStart(3, '0');
    return `CJ-${hoy}-${consecutivo}`;
}

/**
 * POST /api/ventas
 * ============================================================
 * PROCESAR UNA VENTA CON TRANSACCIÓN COMPLETA
 * 
 * Body esperado:
 * {
 *   items: [{ producto_id, cantidad, precio_unitario }],
 *   metodo_pago: 'efectivo' | 'tarjeta' | 'transferencia',
 *   monto_recibido: 200.00  // solo para efectivo
 * }
 * 
 * FLUJO TRANSACCIONAL:
 * 1. BEGIN TRANSACTION
 * 2. Verificar disponibilidad de TODOS los insumos
 * 3. Insertar encabezado de venta
 * 4. Insertar detalles de venta
 * 5. Descontar insumos del inventario
 * 6. COMMIT (si todo es exitoso)
 * 7. ROLLBACK (si cualquier paso falla)
 * ============================================================
 */
router.post('/', async (req, res) => {
    // Obtener una conexión DEDICADA del pool para la transacción
    // (no se puede usar pool.query() para transacciones)
    const connection = await pool.getConnection();

    try {
        const { items, metodo_pago, monto_recibido, notas } = req.body;

        // Validaciones básicas
        if (!items || items.length === 0) {
            connection.release();
            return res.status(400).json({ success: false, error: 'No hay productos en la venta' });
        }
        if (!metodo_pago) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Método de pago requerido' });
        }

        // ==========================================
        // PASO 1: INICIAR TRANSACCIÓN
        // ==========================================
        await connection.beginTransaction();
        console.log('🔄 Transacción iniciada para nueva venta...');

        // ==========================================
        // PASO 2: VERIFICAR DISPONIBILIDAD DE INSUMOS
        // para TODOS los productos antes de proceder
        // ==========================================
        for (const item of items) {
            // Obtener la receta del producto
            const [receta] = await connection.query(`
                SELECT r.insumo_id, r.cantidad_necesaria,
                       i.nombre AS insumo_nombre, i.stock_actual
                FROM recetas r
                JOIN insumos i ON r.insumo_id = i.id
                WHERE r.producto_id = ?
            `, [item.producto_id]);

            // Verificar cada insumo de la receta
            for (const ingrediente of receta) {
                const cantidadNecesaria = ingrediente.cantidad_necesaria * item.cantidad;
                if (ingrediente.stock_actual < cantidadNecesaria) {
                    // ❌ STOCK INSUFICIENTE → ROLLBACK
                    await connection.rollback();
                    connection.release();
                    console.log(`❌ Stock insuficiente: ${ingrediente.insumo_nombre}`);
                    return res.status(400).json({
                        success: false,
                        error: `Stock insuficiente de "${ingrediente.insumo_nombre}". ` +
                               `Disponible: ${ingrediente.stock_actual}, ` +
                               `Necesario: ${cantidadNecesaria}`
                    });
                }
            }
        }

        // ==========================================
        // PASO 3: CALCULAR TOTALES E INSERTAR VENTA
        // ==========================================
        const subtotal = items.reduce((sum, item) => 
            sum + (item.precio_unitario * item.cantidad), 0
        );
        const impuesto = 0; // Sin IVA por ahora (configurable)
        const total = subtotal + impuesto;
        const folio = await generarFolio(connection);
        const cambio = metodo_pago === 'efectivo' ? (monto_recibido - total) : 0;

        const [ventaResult] = await connection.query(`
            INSERT INTO ventas (folio, subtotal, impuesto, total, metodo_pago, monto_recibido, cambio, notas)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [folio, subtotal, impuesto, total, metodo_pago, monto_recibido || null, cambio, notas || null]);

        const ventaId = ventaResult.insertId;
        console.log(`📝 Venta ${folio} creada (ID: ${ventaId})`);

        // ==========================================
        // PASO 4: INSERTAR DETALLES DE VENTA
        // ==========================================
        for (const item of items) {
            const itemSubtotal = item.precio_unitario * item.cantidad;
            await connection.query(`
                INSERT INTO detalles_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?)
            `, [ventaId, item.producto_id, item.cantidad, item.precio_unitario, itemSubtotal]);
        }

        // ==========================================
        // PASO 5: DESCONTAR INSUMOS DEL INVENTARIO
        // Este es el paso crítico que justifica la transacción
        // ==========================================
        for (const item of items) {
            const [receta] = await connection.query(
                'SELECT insumo_id, cantidad_necesaria FROM recetas WHERE producto_id = ?',
                [item.producto_id]
            );

            for (const ingrediente of receta) {
                const cantidadDescontar = ingrediente.cantidad_necesaria * item.cantidad;
                
                // UPDATE con verificación de stock positivo
                const [updateResult] = await connection.query(`
                    UPDATE insumos 
                    SET stock_actual = stock_actual - ?
                    WHERE id = ? AND stock_actual >= ?
                `, [cantidadDescontar, ingrediente.insumo_id, cantidadDescontar]);

                // Si affectedRows === 0, el stock cambió entre la verificación y el descuento
                if (updateResult.affectedRows === 0) {
                    await connection.rollback();
                    connection.release();
                    console.log(`❌ Error de concurrencia al descontar insumo ID: ${ingrediente.insumo_id}`);
                    return res.status(409).json({
                        success: false,
                        error: 'Error de concurrencia: el stock cambió durante la transacción. Intente de nuevo.'
                    });
                }
            }
        }

        // ==========================================
        // PASO 6: COMMIT - Todo fue exitoso ✅
        // ==========================================
        await connection.commit();
        console.log(`✅ Venta ${folio} completada exitosamente. Total: $${total}`);

        // Obtener datos completos de la venta para el ticket
        const [ventaCompleta] = await connection.query(`
            SELECT v.*, 
                   JSON_ARRAYAGG(
                       JSON_OBJECT(
                           'producto', p.nombre,
                           'cantidad', dv.cantidad,
                           'precio_unitario', dv.precio_unitario,
                           'subtotal', dv.subtotal
                       )
                   ) AS detalles
            FROM ventas v
            JOIN detalles_ventas dv ON v.id = dv.venta_id
            JOIN productos p ON dv.producto_id = p.id
            WHERE v.id = ?
            GROUP BY v.id
        `, [ventaId]);

        connection.release();

        res.json({
            success: true,
            mensaje: 'Venta procesada correctamente',
            data: {
                ...ventaCompleta[0],
                detalles: JSON.parse(ventaCompleta[0].detalles)
            }
        });

    } catch (error) {
        // ==========================================
        // ROLLBACK - Error inesperado ❌
        // ==========================================
        await connection.rollback();
        connection.release();
        console.error('❌ Error en transacción de venta (ROLLBACK):', error);
        res.status(500).json({
            success: false,
            error: 'Error al procesar la venta. La transacción fue revertida.',
            detalle: error.message
        });
    }
});

/**
 * GET /api/ventas/hoy
 * Obtiene todas las ventas del día actual
 */
router.get('/hoy', async (req, res) => {
    try {
        const [ventas] = await pool.query(`
            SELECT v.*,
                   GROUP_CONCAT(
                       CONCAT(dv.cantidad, 'x ', p.nombre)
                       SEPARATOR ', '
                   ) AS resumen_productos
            FROM ventas v
            LEFT JOIN detalles_ventas dv ON v.id = dv.venta_id
            LEFT JOIN productos p ON dv.producto_id = p.id
            WHERE DATE(v.fecha) = CURDATE()
            GROUP BY v.id
            ORDER BY v.fecha DESC
        `);
        res.json({ success: true, data: ventas });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener ventas del día' });
    }
});

/**
 * GET /api/ventas/:id
 * Obtiene el detalle completo de una venta (para ticket)
 */
router.get('/:id', async (req, res) => {
    try {
        const [venta] = await pool.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
        if (venta.length === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        }

        const [detalles] = await pool.query(`
            SELECT dv.*, p.nombre AS producto_nombre
            FROM detalles_ventas dv
            JOIN productos p ON dv.producto_id = p.id
            WHERE dv.venta_id = ?
        `, [req.params.id]);

        res.json({
            success: true,
            data: { ...venta[0], detalles }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Error al obtener venta' });
    }
});

module.exports = router;
