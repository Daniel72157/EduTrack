import { pool } from "@/lib/db";

// OPERACIÓN 2: consultar el rendimiento de un estudiante (consulta parametrizada + JOIN).
export async function GET(_req, { params }) {
  const { rows } = await pool.query(
    `SELECT s.student_id, s.age, s.gender, s.education_level, s.school_type, s.urban_rural,
            r.record_id, r.academic_period, r.previous_exam_score, r.attendance_percentage,
            r.study_hours_per_day, r.sleep_hours, r.exam_score, r.performance_grade, r.pass_status, r.performance_level
     FROM students s JOIN academic_records r ON r.student_id = s.student_id
     WHERE s.student_id = $1 ORDER BY r.academic_period`, [params.id.toUpperCase()]);
  if (!rows.length) return Response.json({ ok: false, mensaje: "Estudiante no encontrado" }, { status: 404 });
  return Response.json({ ok: true, registros: rows });
}

// OPERACIÓN 5 (D de CRUD): eliminar un estudiante. Borra la fila de verdad; sus registros se borran por ON DELETE CASCADE.
export async function DELETE(_req, { params }) {
  try {
    const { rows } = await pool.query(
      `WITH r AS (SELECT count(*)::int AS n FROM academic_records WHERE student_id = $1),
            s AS (DELETE FROM students WHERE student_id = $1 RETURNING student_id)
       SELECT (SELECT student_id FROM s) AS student_id, (SELECT n FROM r) AS registros`, [params.id.toUpperCase()]);
    if (!rows[0].student_id) return Response.json({ ok: false, mensaje: "Estudiante no encontrado" }, { status: 404 });
    return Response.json({ ok: true, tipo: "estudiante", id: rows[0].student_id, registrosEliminados: rows[0].registros });
  } catch (err) {
    return Response.json({ ok: false, frenadoPor: "base", regla: err.constraint || null, detalle: err.message }, { status: 422 });
  }
}
