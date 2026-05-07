/**
 * CJ POS - Ruta de Setup (ejecutar UNA sola vez)
 * Crea las tablas e inserta datos iniciales en la BD de Railway
 * ELIMINAR DESPUÉS DE USAR en producción
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/init-db', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // Verificar si ya se ejecutó (si existe tabla productos)
        const [tables] = await connection.query(
            "SHOW TABLES LIKE 'productos'"
        );
        if (tables.length > 0) {
            connection.release();
            return res.json({ 
                success: false, 
                mensaje: '⚠️ Las tablas ya existen. No se necesita ejecutar de nuevo.' 
            });
        }

        // Crear tablas
        await connection.query(`
            CREATE TABLE insumos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                unidad_medida ENUM('gramos', 'mililitros', 'unidades') NOT NULL,
                stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_nombre (nombre),
                INDEX idx_stock (stock_actual, stock_minimo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE productos (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(150) NOT NULL,
                descripcion TEXT,
                precio_venta DECIMAL(10,2) NOT NULL,
                categoria ENUM('hamburguesas', 'complementos', 'bebidas', 'postres', 'combos')
                    NOT NULL DEFAULT 'hamburguesas',
                imagen_url VARCHAR(255) DEFAULT NULL,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_categoria (categoria),
                INDEX idx_activo (activo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE recetas (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                producto_id INT UNSIGNED NOT NULL,
                insumo_id INT UNSIGNED NOT NULL,
                cantidad_necesaria DECIMAL(10,3) NOT NULL,
                CONSTRAINT fk_receta_producto
                    FOREIGN KEY (producto_id) REFERENCES productos(id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT fk_receta_insumo
                    FOREIGN KEY (insumo_id) REFERENCES insumos(id)
                    ON DELETE RESTRICT ON UPDATE CASCADE,
                UNIQUE KEY uq_producto_insumo (producto_id, insumo_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE ventas (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                folio VARCHAR(20) NOT NULL UNIQUE,
                fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                subtotal DECIMAL(10,2) NOT NULL,
                impuesto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                total DECIMAL(10,2) NOT NULL,
                metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
                monto_recibido DECIMAL(10,2) DEFAULT NULL,
                cambio DECIMAL(10,2) DEFAULT NULL,
                estado ENUM('completada', 'cancelada') NOT NULL DEFAULT 'completada',
                notas TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_fecha (fecha),
                INDEX idx_estado (estado),
                INDEX idx_metodo_pago (metodo_pago)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await connection.query(`
            CREATE TABLE detalles_ventas (
                id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                venta_id INT UNSIGNED NOT NULL,
                producto_id INT UNSIGNED NOT NULL,
                cantidad INT UNSIGNED NOT NULL,
                precio_unitario DECIMAL(10,2) NOT NULL,
                subtotal DECIMAL(10,2) NOT NULL,
                CONSTRAINT fk_detalle_venta
                    FOREIGN KEY (venta_id) REFERENCES ventas(id)
                    ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT fk_detalle_producto
                    FOREIGN KEY (producto_id) REFERENCES productos(id)
                    ON DELETE RESTRICT ON UPDATE CASCADE,
                INDEX idx_venta_id (venta_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        console.log('✅ Tablas creadas');

        // Insertar datos iniciales
        await connection.query(`
            INSERT INTO insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario) VALUES
            ('Pan para hamburguesa', 'unidades', 200, 30, 5.00),
            ('Carne de res (150g)', 'unidades', 150, 25, 25.00),
            ('Queso americano', 'unidades', 300, 50, 3.50),
            ('Lechuga', 'gramos', 5000, 500, 0.05),
            ('Tomate', 'unidades', 100, 20, 3.00),
            ('Cebolla', 'unidades', 80, 15, 2.50),
            ('Tocino', 'unidades', 200, 30, 5.00),
            ('Salsa especial CJ', 'mililitros', 3000, 500, 0.10),
            ('Pepinillos', 'unidades', 300, 40, 1.50),
            ('Jalapeños', 'gramos', 2000, 300, 0.08),
            ('Papas (porcion)', 'unidades', 150, 25, 8.00),
            ('Refresco 600ml', 'unidades', 100, 20, 12.00),
            ('Agua 500ml', 'unidades', 80, 15, 6.00)
        `);

        await connection.query(`
            INSERT INTO productos (nombre, descripcion, precio_venta, categoria) VALUES
            ('Hamburguesa Clasica', 'Pan, carne 150g, queso, lechuga, tomate y salsa especial CJ', 89.00, 'hamburguesas'),
            ('Hamburguesa Doble', 'Pan, doble carne 300g, doble queso, lechuga, tomate y salsa CJ', 129.00, 'hamburguesas'),
            ('Hamburguesa BBQ Bacon', 'Pan, carne 150g, tocino, queso, cebolla y BBQ', 109.00, 'hamburguesas'),
            ('Hamburguesa Jalapeno', 'Pan, carne 150g, queso, jalapenos, pepinillos y salsa', 99.00, 'hamburguesas'),
            ('Papas Francesas', 'Porcion generosa de papas fritas crujientes', 45.00, 'complementos'),
            ('Refresco 600ml', 'Refresco de tu eleccion', 25.00, 'bebidas'),
            ('Agua Natural 500ml', 'Agua purificada', 15.00, 'bebidas'),
            ('Combo Clasico', 'Hamburguesa Clasica + Papas + Refresco', 139.00, 'combos'),
            ('Combo Doble', 'Hamburguesa Doble + Papas + Refresco', 179.00, 'combos')
        `);

        // Recetas
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (1,1,1),(1,2,1),(1,3,1),(1,4,30),(1,5,1),(1,8,15)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (2,1,1),(2,2,2),(2,3,2),(2,4,30),(2,5,1),(2,8,20)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (3,1,1),(3,2,1),(3,3,1),(3,7,2),(3,6,1),(3,8,15)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (4,1,1),(4,2,1),(4,3,1),(4,10,20),(4,9,2),(4,8,15)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (5,11,1)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (6,12,1)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (7,13,1)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (8,1,1),(8,2,1),(8,3,1),(8,4,30),(8,5,1),(8,8,15),(8,11,1),(8,12,1)`);
        await connection.query(`INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES (9,1,1),(9,2,2),(9,3,2),(9,4,30),(9,5,1),(9,8,20),(9,11,1),(9,12,1)`);

        console.log('✅ Datos iniciales insertados');
        connection.release();

        res.json({
            success: true,
            mensaje: '✅ Base de datos configurada exitosamente. Tablas creadas y datos iniciales insertados. ¡Ya puedes usar el POS!'
        });

    } catch (error) {
        connection.release();
        console.error('❌ Error en setup:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
