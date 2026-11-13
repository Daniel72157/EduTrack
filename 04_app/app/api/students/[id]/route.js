import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fallo, json, ruta } from "@/lib/api";

// Ficha completa de un estudiante con TODOS sus reportes académicos.
// Un estudiante solo puede ver la suya; profesores y administrativos, cualquiera.
export const GET = ruta(async (req, { params, user }) => {
  const id = String(params.id).toUpperCase();
  if (user.role === "student" && user.student_id !== id) {
    await audit({ user, action: "acceso.denegado", entityType: "student", entityId: id, details: { motivo: "ficha ajena" }, req });
    fallo(403, "Solo puedes consultar tu propia información.");
  }

  const { rows: p } = await pool.query(
    `SELECT s.*, u.user_id, u.full_name, u.email, u.active
     FROM students s LEFT JOIN users u ON u.student_id = s.student_id WHERE s.student_id = $1`, [id]);
  if (!p.length) fallo(404, "Estudiante no encontrado");

  const { rows: reportes } = await pool.query(
    `SELECT a.record_id, a.academic_period, a.subject, a.evaluation, a.exam_score, a.performance_grade, a.pass_status,
            a.performance_level, a.previous_exam_score, a.attendance_percentage, a.assignment_completion_rate,
            a.study_hours_per_day, a.sleep_hours, a.comments, a.created_at, a.updated_at,
            u.full_name AS profesor,
            (SELECT json_build_object('request_id', c.request_id, 'action', c.action)
               FROM change_requests c WHERE c.entity_type = 'record' AND c.entity_id = a.record_id::text
                AND c.status = 'pending') AS pendiente
     FROM academic_records a LEFT JOIN users u ON u.user_id = a.created_by
     WHERE a.student_id = $1
     ORDER BY a.academic_period DESC, a.subject, a.evaluation, a.record_id`, [id]);

  const { rows: pend } = await pool.query(
    `SELECT request_id, changes, reason, created_at FROM change_requests
     WHERE entity_type = 'student' AND entity_id = $1 AND status = 'pending'`, [id]);

  await audit({ user, action: "estudiante.consultado", entityType: "student", entityId: id, req });
  return json({ ok: true, perfil: p[0], reportes, perfilPendiente: pend[0] || null });
});
