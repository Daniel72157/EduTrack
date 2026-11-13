import { Pool } from "pg";
// La clave NUNCA va en el código: viene de la variable de entorno DATABASE_URL.
const url = process.env.DATABASE_URL;
const local = !url || /localhost|127\.0\.0\.1|host=\//.test(url);
export const pool =
  globalThis._pool ||
  (globalThis._pool = new Pool({ connectionString: url, max: 3, ssl: local ? false : { rejectUnauthorized: false } }));

// Ejecuta fn(client) dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza error.
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
