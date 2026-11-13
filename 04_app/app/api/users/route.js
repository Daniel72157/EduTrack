import { pool, tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, ROLES, validarClave } from "@/lib/auth";
import { limpiar, tieneCodigo, validarPerfil } from "@/lib/validate";
import { fallo, json, leerJson, paginacion, ruta } from "@/lib/api";

// Listar cuentas (administrativos).
export const GET = ruta(async (req) => {
  const url = new URL(req.url);
  const { page, size, offset } = paginacion(url);
  const where = [], vals = [];
  const q = (url.searchParams.get("q") || "").trim();
  const rol = url.searchParams.get("role");
  if (q) { vals.push(`%${q.replace(/[%_\\]/g, "\\$&")}%`); where.push(`(full_name ILIKE $${vals.length} OR email ILIKE $${vals.length} OR student_id ILIKE $${vals.length})`); }
  if (ROLES.includes(rol)) { vals.push(rol); where.push(`role = $${vals.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT user_id, email, full_name, role, student_id, active, created_at, last_login_at, count(*) OVER()::int AS total
     FROM users ${w} ORDER BY created_at DESC LIMIT ${size} OFFSET ${offset}`, vals);
  return json({ ok: true, page, size, total: rows[0]?.total ?? 0, usuarios: rows.map(({ total, ...r }) => r) });
}, { roles: ["admin"] });

// Crear cuenta (administrativos). Para un estudiante: se liga a una ficha existente (student_id)
// o se crea una ficha nueva con `perfil`, todo en una transacción.
export const POST = ruta(async (req, { user }) => {
  const b = await leerJson(req);
  const errores = [];
  const email = String(b.email || "").trim().toLowerCase();
  const full_name = limpiar(b.full_name);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errores.push("Correo inválido");
  if (full_name.length < 2 || full_name.length > 120) errores.push("El nombre debe tener entre 2 y 120 caracteres");
  else if (tieneCodigo(full_name)) errores.push("El nombre no admite etiquetas HTML ni código");
  if (!ROLES.includes(b.role)) errores.push("Rol inválido");
  const errClave = validarClave(b.password);
  if (errClave) errores.push(errClave);

  let perfil = null, studentId = null;
  if (b.role === "student") {
    if (b.student_id) studentId = String(b.student_id).trim().toUpperCase();
    else {
      const v = validarPerfil({ ...(b.perfil || {}), full_name }, { parcial: false });
      errores.push(...v.errores);
      const { full_name: _n, ...resto } = v.datos;
      perfil = resto;
    }
  }
  if (errores.length) fallo(400, "Revisa los datos de la cuenta", { frenadoPor: "app", errores });

  const nuevo = await tx(async (db) => {
    if (perfil) {
      const cols = Object.keys(perfil);
      const { rows } = await db.query(
        `INSERT INTO students (student_id, ${cols.join(", ")})
         VALUES ('STU_W' || lpad(nextval('web_student_seq')::text, 6, '0'), ${cols.map((_, i) => `$${i + 1}`).join(", ")})
         RETURNING student_id`, Object.values(perfil));
      studentId = rows[0].student_id;
      await audit({ db, user, action: "estudiante.creado", entityType: "student", entityId: studentId, details: perfil, req });
    } else if (studentId) {
      const { rows } = await db.query(
        "SELECT s.student_id, u.email FROM students s LEFT JOIN users u ON u.student_id = s.student_id WHERE s.student_id = $1", [studentId]);
      if (!rows.length) fallo(404, `No existe la ficha ${studentId}`);
      if (rows[0].email) fallo(409, `La ficha ${studentId} ya tiene la cuenta ${rows[0].email}`);
    }
    try {
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role, student_id, must_change_password) VALUES ($1,$2,$3,$4,$5,true)
         RETURNING user_id, email, full_name, role, student_id, active, created_at`,
        [email, await hashPassword(b.password), full_name, b.role, studentId]);
      await audit({ db, user, action: "usuario.creado", entityType: "user", entityId: rows[0].user_id,
        details: { email, full_name, role: b.role, student_id: studentId }, req });
      return rows[0];
    } catch (err) {
      if (err.constraint === "users_email_key") fallo(409, "Ya existe una cuenta con ese correo");
      throw err;
    }
  });
  return json({ ok: true, mensaje: `Cuenta creada para ${nuevo.email}`, usuario: nuevo }, 201);
}, { roles: ["admin"] });
