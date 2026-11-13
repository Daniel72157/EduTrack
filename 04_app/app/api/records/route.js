import { tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { validarReporte } from "@/lib/validate";
import { fallo, json, leerJson, ruta } from "@/lib/api";

// Subir un reporte académico nuevo (profesores). Un estudiante puede tener tantos reportes como
// combinaciones distintas de periodo + asignatura + evaluación.
export const POST = ruta(async (req, { user }) => {
  const b = await leerJson(req);
  const studentId = String(b.student_id || "").trim().toUpperCase();
  const { datos, errores } = validarReporte(b);
  if (!studentId) errores.unshift("student_id es obligatorio");
  if (errores.length) fallo(400, "Revisa los datos del reporte", { frenadoPor: "app", errores });

  const record = await tx(async (db) => {
    const cols = ["student_id", "created_by", ...Object.keys(datos)];
    const vals = [studentId, user.user_id, ...Object.values(datos)];
    const { rows } = await db.query(
      `INSERT INTO academic_records (${cols.join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`, vals);
    await audit({ db, user, action: "reporte.creado", entityType: "record", entityId: rows[0].record_id,
      details: { student_id: studentId, ...datos }, req });
    return rows[0];
  });
  return json({ ok: true, mensaje: `Reporte ${record.record_id} creado`, record }, 201);
}, { roles: ["teacher"] });
