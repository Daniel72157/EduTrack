import { pool } from "@/lib/db";

// Registra una acción en la bitácora. Si se pasa `db` (cliente de una transacción), el log queda
// dentro de la MISMA transacción que el cambio: o se guardan los dos o ninguno.
export async function audit({ db = pool, user, email, role, action, entityType = null, entityId = null, details = null, req }) {
  const ip = req?.headers.get("x-forwarded-for")?.split(",")[0].trim() || req?.headers.get("x-real-ip") || null;
  const ua = req?.headers.get("user-agent")?.slice(0, 300) || null;
  await db.query(
    `INSERT INTO audit_log (user_id, user_email, user_role, action, entity_type, entity_id, details, ip, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [user?.user_id ?? null, user?.email ?? email ?? null, user?.role ?? role ?? null, action, entityType,
     entityId == null ? null : String(entityId), details ? JSON.stringify(details) : null, ip, ua]);
}
