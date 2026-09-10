import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

// Consulta suelta, fuera de transacción. Solo para lecturas.
export const consultar = (sql, params) => pool.query(sql, params);
