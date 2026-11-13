import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { json, paginacion, ruta } from "@/lib/api";

// Buscar estudiantes (profesores y administrativos). q = ID exacto (STU_...), nombre o correo de su cuenta.
export const GET = ruta(async (req, { user }) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const conCuenta = url.searchParams.get("con_cuenta") === "1";
  const { page, size, offset } = paginacion(url);

  const where = [], vals = [];
  if (q) {
    vals.push(q.toUpperCase(), `%${q.replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(s.student_id = $1 OR u.full_name ILIKE $2 OR u.email ILIKE $2)`);
  }
  if (conCuenta) where.push("u.user_id IS NOT NULL");
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  // Primero se pagina (pocas filas) y solo después se calculan los agregados de esa página.
  const [{ rows }, { rows: c }] = await Promise.all([
    pool.query(
      `WITH pagina AS (
         SELECT s.student_id, s.age, s.education_level, s.school_type, u.full_name, u.email, u.user_id
         FROM students s LEFT JOIN users u ON u.student_id = s.student_id
         ${w}
         ORDER BY (u.user_id IS NULL), s.student_id
         LIMIT ${size} OFFSET ${offset})
       SELECT p.student_id, p.age, p.education_level, p.school_type, p.full_name, p.email, r.reportes, r.promedio
       FROM pagina p
       LEFT JOIN LATERAL (SELECT count(*)::int AS reportes, round(avg(exam_score), 1) AS promedio
                          FROM academic_records a WHERE a.student_id = p.student_id) r ON true
       ORDER BY (p.user_id IS NULL), p.student_id`, vals),
    pool.query(`SELECT count(*)::int AS n FROM students s LEFT JOIN users u ON u.student_id = s.student_id ${w}`, vals),
  ]);
  const total = c[0].n;

  if (q) await audit({ user, action: "estudiantes.buscados", details: { q, resultados: total }, req });
  return json({ ok: true, page, size, total, estudiantes: rows });
}, { roles: ["teacher", "admin"] });
