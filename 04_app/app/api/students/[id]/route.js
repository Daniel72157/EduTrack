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
