import { pool } from "@/lib/db";
import { validar, grade, level, status } from "@/lib/validate";

// OPERACIÓN 1: registrar estudiante + registro académico en UNA transacción.
export async function POST(req) {
  const b = await req.json();
  const errores = validar(b);
  if (errores.length) return Response.json({ ok: false, frenadoPor: "app", errores }, { status: 400 });

  const s = Number(b.exam_score);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const st = await client.query(
      `INSERT INTO students (student_id, age, gender, education_level, school_type, urban_rural, family_income, internet_access)
       VALUES ('STU_W' || lpad(nextval('web_student_seq')::text, 6, '0'), $1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.age, b.gender, b.education_level, b.school_type, b.urban_rural, b.family_income || null, b.internet_access === "1"]);
    const sid = st.rows[0].student_id;
    const rec = await client.query(
      `INSERT INTO academic_records (student_id, academic_period, previous_exam_score, attendance_percentage,
         study_hours_per_day, sleep_hours, exam_score, performance_grade, pass_status, performance_level)
       VALUES ($1,'WEB-2026',$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [sid, b.previous_exam_score || null, b.attendance_percentage || null, b.study_hours_per_day || null,
       b.sleep_hours || null, s, grade(s), status(s), level(s)]);
    await client.query("COMMIT");
    return Response.json({ ok: true, mensaje: "Estudiante y registro guardados en una transacción (COMMIT)", student: st.rows[0], record: rec.rows[0] }, { status: 201 });
  } catch (err) {
    await client.query("ROLLBACK");
    return Response.json({ ok: false, frenadoPor: "base", mensaje: "ROLLBACK: no se guardó nada", regla: err.constraint || null, detalle: err.message }, { status: 422 });
  } finally { client.release(); }
}
