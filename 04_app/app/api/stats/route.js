import { pool } from "@/lib/db";
import { json, ruta } from "@/lib/api";

// Resumen general para el panel administrativo.
export const GET = ruta(async () => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT count(*) FROM students)::int AS estudiantes,
      (SELECT count(*) FROM academic_records)::int AS reportes,
      (SELECT round(avg(exam_score), 1) FROM academic_records) AS promedio,
      (SELECT round(100.0 * avg((pass_status = 'Pass')::int), 1) FROM academic_records) AS aprobacion,
      (SELECT count(*) FROM change_requests WHERE status = 'pending')::int AS pendientes,
      (SELECT count(*) FROM audit_log WHERE at > now() - interval '24 hours')::int AS eventos24h,
      (SELECT count(*) FROM audit_log WHERE action = 'sesion.fallida' AND at > now() - interval '24 hours')::int AS fallidos24h,
      (SELECT count(*) FROM academic_records WHERE created_at > now() - interval '7 days' AND created_by IS NOT NULL)::int AS reportes7d,
      (SELECT json_object_agg(role, n) FROM (SELECT role, count(*)::int AS n FROM users WHERE active GROUP BY role) x) AS cuentas`);
  return json({ ok: true, ...rows[0] });
}, { roles: ["admin"] });
