import "dotenv/config";
import pg from "pg";
const { Pool } = pg;

const useSsl = String(process.env.DB_SSL || "false").toLowerCase() === "true";
const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() === "true";

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: (process.env.DB_PORT && Number(process.env.DB_PORT)) || 5432,
    database: process.env.DB_NAME || "woori_accounting",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
});

export default pool;
