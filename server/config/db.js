/**
 * CJ POS - Configuración de conexión a MySQL/MariaDB
 * Soporta conexión local (variables individuales) y
 * Railway/cloud (MYSQL_URL o DATABASE_URL)
 */
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

let poolConfig;

// Railway provee MYSQL_URL o DATABASE_URL automáticamente
const dbUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;

if (dbUrl) {
    // Conexión vía URL (producción / Railway)
    poolConfig = {
        uri: dbUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };
} else {
    // Conexión vía variables individuales (desarrollo local)
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cj_pos',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
    };
}

const pool = mysql.createPool(poolConfig);

// Verificar conexión al iniciar
pool.getConnection()
    .then(conn => {
        console.log('✅ Conectado a la base de datos');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error de conexión a la BD:', err.message);
        process.exit(1);
    });

module.exports = pool;
