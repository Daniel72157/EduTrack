import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { json, ruta } from "@/lib/api";

// Prueba de defensa en profundidad (solo administrativos): salta A PROPÓSITO la validación de la app
// para probar que la BASE sola frena exam_score=150. Siempre termina en ROLLBACK.
export const POST = ruta(async (req, { user }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO students (student_id, age, gender, education_level, school_type, urban_rural)
                        VALUES ('STU_DEMO01', 18, 'Male', 'High School', 'Public', 'Urban')`);
    await client.query(`INSERT INTO academic_records (student_id, academic_period, exam_score, performance_grade, pass_status, performance_level)
                        VALUES ('STU_DEMO01', 'DEMO', $1, 'A', 'Pass', 'High')`, [150]);
    await client.query("ROLLBACK");
    return json({ ok: false, mensaje: "Inesperado: la base aceptó 150" }, 500);
  } catch (err) {
    await client.query("ROLLBACK");
    const { rows } = await client.query("SELECT count(*)::int AS n FROM students WHERE student_id = 'STU_DEMO01'");
    await audit({ db: client, user, action: "demo.rechazo", details: { regla: err.constraint, codigo: err.code }, req });
    return json({
      ok: false, frenadoPor: "base", regla: err.constraint, codigoPostgres: err.code,
      mensaje: "La base RECHAZÓ exam_score = 150 (CHECK exam_score BETWEEN 0 AND 100). Se hizo ROLLBACK.",
      filasGuardadas: rows[0].n,
    }, 422);
  } finally { client.release(); }
}, { roles: ["admin"] });
