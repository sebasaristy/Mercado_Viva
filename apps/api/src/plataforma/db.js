import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.db.url,
  ssl: config.db.ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (e) => {
  process.stderr.write("pool de Postgres: " + e.message + "\n");
});

// Consulta suelta, fuera de transacción. Para escrituras usar enTransaccion().
export const consultar = (sql, params) => pool.query(sql, params);

export const cerrarPool = () => pool.end();
