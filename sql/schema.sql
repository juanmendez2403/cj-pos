-- =============================================
-- CJ Hamburguesas - Esquema de Base de Datos
-- Sistema POS con Gestión de Inventario
-- Motor: MariaDB 10.5+
-- =============================================

CREATE DATABASE IF NOT EXISTS cj_pos
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cj_pos;

-- =============================================
-- Tabla: insumos
-- Ingredientes/insumos crudos del inventario
-- =============================================
CREATE TABLE insumos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    unidad_medida ENUM('gramos', 'mililitros', 'unidades') NOT NULL
        COMMENT 'Unidad base de medición del insumo',
    stock_actual DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Cantidad disponible en stock',
    stock_minimo DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Umbral de alerta de stock bajo',
    costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0.00
        COMMENT 'Costo por unidad de medida',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nombre (nombre),
    INDEX idx_stock (stock_actual, stock_minimo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Inventario de insumos/ingredientes crudos';

-- =============================================
-- Tabla: productos
-- Catálogo de productos finales para venta
-- =============================================
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
COMMENT='Catálogo de productos para venta';

-- =============================================
-- Tabla: recetas (tabla pivote)
-- Vincula producto con insumos y cantidades
-- =============================================
CREATE TABLE recetas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    producto_id INT UNSIGNED NOT NULL,
    insumo_id INT UNSIGNED NOT NULL,
    cantidad_necesaria DECIMAL(10,3) NOT NULL
        COMMENT 'Cantidad del insumo por unidad de producto',
    CONSTRAINT fk_receta_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_receta_insumo
        FOREIGN KEY (insumo_id) REFERENCES insumos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_producto_insumo (producto_id, insumo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recetas: relación producto-insumo con cantidades';

-- =============================================
-- Tabla: ventas
-- Encabezado/resumen de cada venta
-- =============================================
CREATE TABLE ventas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) NOT NULL UNIQUE
        COMMENT 'Identificador legible (ej: CJ-20260502-001)',
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal DECIMAL(10,2) NOT NULL,
    impuesto DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia') NOT NULL,
    monto_recibido DECIMAL(10,2) DEFAULT NULL
        COMMENT 'Solo para pagos en efectivo',
    cambio DECIMAL(10,2) DEFAULT NULL,
    estado ENUM('completada', 'cancelada') NOT NULL DEFAULT 'completada',
    notas TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fecha (fecha),
    INDEX idx_estado (estado),
    INDEX idx_metodo_pago (metodo_pago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Registro maestro de ventas';

-- =============================================
-- Tabla: detalles_ventas
-- Líneas individuales de cada venta
-- =============================================
CREATE TABLE detalles_ventas (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    venta_id INT UNSIGNED NOT NULL,
    producto_id INT UNSIGNED NOT NULL,
    cantidad INT UNSIGNED NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL
        COMMENT 'Precio snapshot al momento de la venta',
    subtotal DECIMAL(10,2) NOT NULL
        COMMENT 'cantidad * precio_unitario',
    CONSTRAINT fk_detalle_venta
        FOREIGN KEY (venta_id) REFERENCES ventas(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_detalle_producto
        FOREIGN KEY (producto_id) REFERENCES productos(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    INDEX idx_venta_id (venta_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detalle/líneas de cada venta';

-- =============================================
-- DATOS DE PRUEBA (SEED DATA)
-- =============================================

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
('Papas (porción)', 'unidades', 150, 25, 8.00),
('Refresco 600ml', 'unidades', 100, 20, 12.00),
('Agua 500ml', 'unidades', 80, 15, 6.00);

INSERT INTO productos (nombre, descripcion, precio_venta, categoria) VALUES
('Hamburguesa Clásica', 'Pan, carne 150g, queso, lechuga, tomate y salsa especial CJ', 89.00, 'hamburguesas'),
('Hamburguesa Doble', 'Pan, doble carne 300g, doble queso, lechuga, tomate y salsa CJ', 129.00, 'hamburguesas'),
('Hamburguesa BBQ Bacon', 'Pan, carne 150g, tocino, queso, cebolla y BBQ', 109.00, 'hamburguesas'),
('Hamburguesa Jalapeño', 'Pan, carne 150g, queso, jalapeños, pepinillos y salsa', 99.00, 'hamburguesas'),
('Papas Francesas', 'Porción generosa de papas fritas crujientes', 45.00, 'complementos'),
('Refresco 600ml', 'Refresco de tu elección', 25.00, 'bebidas'),
('Agua Natural 500ml', 'Agua purificada', 15.00, 'bebidas'),
('Combo Clásico', 'Hamburguesa Clásica + Papas + Refresco', 139.00, 'combos'),
('Combo Doble', 'Hamburguesa Doble + Papas + Refresco', 179.00, 'combos');

-- Recetas: Hamburguesa Clásica (prod 1)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(1, 1, 1), (1, 2, 1), (1, 3, 1), (1, 4, 30), (1, 5, 1), (1, 8, 15);

-- Recetas: Hamburguesa Doble (prod 2)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(2, 1, 1), (2, 2, 2), (2, 3, 2), (2, 4, 30), (2, 5, 1), (2, 8, 20);

-- Recetas: BBQ Bacon (prod 3)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(3, 1, 1), (3, 2, 1), (3, 3, 1), (3, 7, 2), (3, 6, 1), (3, 8, 15);

-- Recetas: Jalapeño (prod 4)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(4, 1, 1), (4, 2, 1), (4, 3, 1), (4, 10, 20), (4, 9, 2), (4, 8, 15);

-- Recetas: Papas (prod 5)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(5, 11, 1);

-- Recetas: Refresco (prod 6)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(6, 12, 1);

-- Recetas: Agua (prod 7)
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(7, 13, 1);

-- Recetas: Combo Clásico (prod 8) = Hamburguesa Clásica + Papas + Refresco
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(8, 1, 1), (8, 2, 1), (8, 3, 1), (8, 4, 30), (8, 5, 1), (8, 8, 15), (8, 11, 1), (8, 12, 1);

-- Recetas: Combo Doble (prod 9) = Hamburguesa Doble + Papas + Refresco
INSERT INTO recetas (producto_id, insumo_id, cantidad_necesaria) VALUES
(9, 1, 1), (9, 2, 2), (9, 3, 2), (9, 4, 30), (9, 5, 1), (9, 8, 20), (9, 11, 1), (9, 12, 1);
