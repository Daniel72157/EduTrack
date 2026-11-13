import { pool, tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { cargarEntidad, prepararCambios } from "@/lib/requests";
import { limpiar, tieneCodigo } from "@/lib/validate";
import { fallo, json, leerJson, paginacion, ruta } from "@/lib/api";

const ESTADOS = ["pending", "approved", "rejected", "cancelled"];

// Listar solicitudes. Administrativo: todas. Profesor/estudiante: solo las suyas.
export const GET = ruta(async (req, { user }) => {
  const url = new URL(req.url);
  const { page, size, offset } = paginacion(url);
  const where = [], vals = [];
  const estado = url.searchParams.get("status");
  if (estado && ESTADOS.includes(estado)) { vals.push(estado); where.push(`c.status = $${vals.length}`); }
  if (user.role !== "admin") { vals.push(user.user_id); where.push(`c.requested_by = $${vals.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await pool.query(
    `SELECT c.*, rq.full_name AS solicitante, rq.email AS solicitante_email, rq.role AS solicitante_rol,
            rv.full_name AS revisor,
            CASE WHEN c.entity_type = 'record' THEN coalesce(a.student_id, c.previous->>'student_id') ELSE c.entity_id END AS student_id,
            a.academic_period, a.subject, a.evaluation,
            count(*) OVER()::int AS total
     FROM change_requests c
     JOIN users rq ON rq.user_id = c.requested_by
     LEFT JOIN users rv ON rv.user_id = c.reviewed_by
     LEFT JOIN LATERAL (SELECT student_id, academic_period, subject, evaluation FROM academic_records
                        WHERE record_id = CASE WHEN c.entity_type = 'record' THEN c.entity_id::bigint END) a ON true
     ${w}
     ORDER BY (c.status = 'pending') DESC, c.created_at DESC
     LIMIT ${size} OFFSET ${offset}`, vals);
  return json({ ok: true, page, size, total: rows[0]?.total ?? 0, solicitudes: rows.map(({ total, ...r }) => r) });
});

// Crear una solicitud de cambio.
//  - Profesor: modificar o eliminar un reporte académico (entity_type = 'record').
//  - Estudiante: modificar su propio perfil (entity_type = 'student').
// Siempre con una razón; queda pendiente hasta que un administrativo la apruebe o rechace.
export const POST = ruta(async (req, { user }) => {
  const b = await leerJson(req);
  const reason = limpiar(b.reason);
  const accion = b.action === "delete" ? "delete" : "update";
  let tipo, id;
  if (user.role === "teacher") { tipo = "record"; id = String(b.entity_id || "").trim(); }
  else if (user.role === "student") {
    tipo = "student"; id = user.student_id;
    if (accion !== "update") fallo(400, "Solo puedes solicitar cambios a tu perfil");
  } else fallo(403, "Los administrativos aprueban solicitudes; no las crean.");
  if (reason.length < 10) fallo(400, "Explica la razón del cambio (mínimo 10 caracteres)", { frenadoPor: "app" });
  if (reason.length > 1000) fallo(400, "La razón admite máximo 1000 caracteres", { frenadoPor: "app" });
  if (tieneCodigo(reason)) fallo(400, "La razón no admite etiquetas HTML ni código", { frenadoPor: "app" });

  const sol = await tx(async (db) => {
    const actual = await cargarEntidad(db, tipo, id);
    if (!actual) fallo(404, tipo === "record" ? "Ese reporte no existe" : "No se encontró tu ficha de estudiante");
    const { changes, previous } = prepararCambios(tipo, accion, b.changes, actual);
    try {
      const { rows } = await db.query(
        `INSERT INTO change_requests (entity_type, entity_id, action, changes, previous, reason, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [tipo, id, accion, JSON.stringify(changes), JSON.stringify(previous), reason, user.user_id]);
      await audit({ db, user, action: "solicitud.creada", entityType: tipo, entityId: id,
        details: { solicitud: rows[0].request_id, accion, cambios: changes, razon: reason }, req });
      return rows[0];
    } catch (err) {
      if (err.constraint === "uq_req_pending")
        fallo(409, "Ya hay una solicitud pendiente sobre este elemento. Espera a que se resuelva o cancélala.");
      throw err;
    }
  });
  return json({ ok: true, mensaje: `Solicitud #${sol.request_id} enviada. Un administrativo la revisará.`, solicitud: sol }, 201);
}, { roles: ["teacher", "student"] });
