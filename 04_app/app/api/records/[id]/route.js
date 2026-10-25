import { pool } from "@/lib/db";
import { validar, grade, level, status } from "@/lib/validate";

const EDITABLES = ["exam_score", "previous_exam_score", "attendance_percentage", "sleep_hours", "study_hours_per_day"];

// OPERACIÓN 3: actualizar un registro académico (id = record_id). Recalcula grado/estado/nivel si cambia exam_score.
export async function PATCH(req, { params }) {
  const b = await req.json();
  const campos = EDITABLES.filter((c) => b[c] !== undefined && b[c] !== "");
  if (!campos.length) return Response.json({ ok: false, frenadoPor: "app", errores: ["nada que actualizar"] }, { status: 400 });
  const errores = validar(b, { soloRegistro: true, requerirEstudiante: false }).filter((x) => !x.endsWith("es obligatorio"));
  if (errores.length) return Response.json({ ok: false, frenadoPor: "app", errores }, { status: 400 });

  const sets = [], vals = [];
  for (const c of campos) { vals.push(Number(b[c])); sets.push(`${c} = $${vals.length}`); }
  if (b.exam_score !== undefined && b.exam_score !== "") {
    const s = Number(b.exam_score);
    vals.push(grade(s), status(s), level(s));
    sets.push(`performance_grade = $${vals.length - 2}`, `pass_status = $${vals.length - 1}`, `performance_level = $${vals.length}`);
  }
  vals.push(params.id);
  try {
    const { rows } = await pool.query(`UPDATE academic_records SET ${sets.join(", ")} WHERE record_id = $${vals.length} RETURNING *`, vals);
    if (!rows.length) return Response.json({ ok: false, mensaje: "record_id no existe" }, { status: 404 });
    return Response.json({ ok: true, mensaje: "Registro actualizado", record: rows[0] });
  } catch (err) {
    return Response.json({ ok: false, frenadoPor: "base", regla: err.constraint || null, detalle: err.message }, { status: 422 });
  }
}

// OPERACIÓN 5 (D de CRUD): eliminar un registro académico por record_id.
export async function DELETE(_req, { params }) {
  try {
    const { rows } = await pool.query("DELETE FROM academic_records WHERE record_id = $1 RETURNING record_id, student_id", [params.id]);
    if (!rows.length) return Response.json({ ok: false, mensaje: "record_id no existe" }, { status: 404 });
    return Response.json({ ok: true, tipo: "registro", id: rows[0].record_id, student_id: rows[0].student_id });
  } catch (err) {
    return Response.json({ ok: false, frenadoPor: "base", regla: err.constraint || null, detalle: err.message }, { status: 422 });
  }
}
