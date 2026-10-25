import { pool } from "@/lib/db";

// OPERACIÓN 4: rechazo. Salta A PROPÓSITO la validación de la app para probar que la BASE sola frena exam_score=150.
// Siempre termina en ROLLBACK: no deja basura aunque algo pasara.
export async function POST() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO students (student_id, age, gender, education_level, school_type, urban_rural)
                        VALUES ('STU_DEMO01', 18, 'Male', 'High School', 'Public', 'Urban')`);
    await client.query(`INSERT INTO academic_records (student_id, academic_period, exam_score, performance_grade, pass_status, performance_level)
                        VALUES ('STU_DEMO01', 'DEMO', $1, 'A', 'Pass', 'High')`, [150]);
    await client.query("ROLLBACK");
    return Response.json({ ok: false, mensaje: "Inesperado: la base aceptó 150" }, { status: 500 });
  } catch (err) {
    await client.query("ROLLBACK");
    const { rows } = await client.query("SELECT count(*)::int AS n FROM students WHERE student_id = 'STU_DEMO01'");
    return Response.json({
      ok: false, frenadoPor: "base", regla: err.constraint, codigoPostgres: err.code,
      mensaje: "La base RECHAZÓ exam_score = 150 (CHECK exam_score BETWEEN 0 AND 100). Se hizo ROLLBACK.",
      filasGuardadas: rows[0].n,
    }, { status: 422 });
  } finally { client.release(); }
}
