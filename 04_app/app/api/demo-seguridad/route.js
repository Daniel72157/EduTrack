import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { validarReporte } from "@/lib/validate";
import { json, ruta } from "@/lib/api";

// Evidencia de seguridad para el Paso 4 (solo administrativos, no modifica datos):
//  A) una "inyección SQL" enviada como texto no se ejecuta,
//  B) un script HTML en un formulario es rechazado,
//  C) las contraseñas se guardan con bcrypt (irreversible, con sal aleatoria).
export const POST = ruta(async (req, { user }) => {
  const payloadSql = "'; DROP TABLE students; --";
  const tabla = async () => (await pool.query("SELECT to_regclass('public.students') IS NOT NULL AS existe, (SELECT count(*)::int FROM students) AS filas")).rows[0];
  const antes = await tabla();

  // A) Misma forma de consulta que usan la búsqueda y el login: el texto viaja aparte, como parámetro.
  const busqueda = await pool.query(
    `SELECT count(*)::int AS n FROM students s LEFT JOIN users u ON u.student_id = s.student_id
     WHERE s.student_id = $1 OR u.full_name ILIKE $2 OR u.email ILIKE $2`, [payloadSql.toUpperCase(), `%${payloadSql}%`]);
  const login = await pool.query("SELECT user_id FROM users WHERE email = $1", ["admin@x.com' OR '1'='1"]);
  const despues = await tabla();

  // B) Texto con código en un campo de formulario.
  const script = '<script>alert("hack")</script>';
  const v = validarReporte({ academic_period: "2026-1", subject: script, evaluation: "Parcial", exam_score: 80 });

  // C) Hash de la propia cuenta (enmascarado) y prueba de sal aleatoria.
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE user_id = $1", [user.user_id]);
  const h = rows[0].password_hash;
  const h1 = await hashPassword("Ejemplo1234"), h2 = await hashPassword("Ejemplo1234");

  await audit({ user, action: "demo.seguridad", req });
  return json({
    ok: true,
    sql: {
      textoEnviado: payloadSql,
      consultaSiSeConcatenara: `SELECT * FROM students WHERE student_id = '${payloadSql}'`,
      consultaReal: "SELECT … WHERE s.student_id = $1 OR … ILIKE $2   (el texto viaja como parámetro, nunca como orden)",
      coincidencias: busqueda.rows[0].n, loginInyectadoEncontro: login.rowCount,
      tablaExisteAntes: antes.existe, tablaExisteDespues: despues.existe, filasAntes: antes.filas, filasDespues: despues.filas,
    },
    html: { textoEnviado: script, rechazado: v.errores.length > 0, errores: v.errores },
    clave: {
      hashGuardado: `${h.slice(0, 20)}…`, longitud: h.length, algoritmo: h.slice(0, 4), costo: h.slice(4, 6),
      mismaClaveDosHashes: [`${h1.slice(0, 20)}…`, `${h2.slice(0, 20)}…`],
      hashesIguales: h1 === h2, ambosVerifican: (await verifyPassword("Ejemplo1234", h1)) && (await verifyPassword("Ejemplo1234", h2)),
    },
  });
}, { roles: ["admin"] });
