import { audit } from "@/lib/audit";
import { fallo } from "@/lib/api";
import { diferencias, PROFILE_FIELDS, RECORD_FIELDS, validarPerfil, validarReporte } from "@/lib/validate";

const soloCampos = (obj, permitidos) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([k]) => permitidos.includes(k)));

/** Valores actuales de un reporte o de un perfil (bloqueados FOR UPDATE si se pide). */
export async function cargarEntidad(db, tipo, id, { bloquear = false } = {}) {
  const lock = bloquear ? "FOR UPDATE" : "";
  if (tipo === "record") {
    if (!/^\d+$/.test(String(id))) fallo(400, "record_id inválido");
    const { rows } = await db.query(`SELECT * FROM academic_records WHERE record_id = $1 ${lock}`, [id]);
    return rows[0] || null;
  }
  const { rows } = await db.query(
    `SELECT s.*, u.full_name FROM students s LEFT JOIN users u ON u.student_id = s.student_id
     WHERE s.student_id = $1 ${bloquear ? "FOR UPDATE OF s" : ""}`, [id]);
  return rows[0] || null;
}

/**
 * Valida una propuesta de cambio y devuelve { changes, previous } con SOLO los campos que cambian.
 * Lanza HttpError 400 si no es válida o si no cambia nada.
 */
export function prepararCambios(tipo, accion, propuesta, actual) {
  if (accion === "delete") return { changes: {}, previous: actual };
  const permitidos = tipo === "record" ? RECORD_FIELDS : PROFILE_FIELDS;
  const { datos, errores } = tipo === "record"
    ? validarReporte(soloCampos(propuesta, permitidos), { parcial: true })
    : validarPerfil(soloCampos(propuesta, permitidos), { parcial: true });
  if (errores.length) fallo(400, "Revisa los cambios propuestos", { frenadoPor: "app", errores });
  const changes = diferencias(datos, actual);
  if (!Object.keys(changes).length) fallo(400, "Los valores propuestos son iguales a los actuales: no hay nada que cambiar");
  const previous = Object.fromEntries(Object.keys(changes).map((k) => [k, actual[k] ?? null]));
  return { changes, previous };
}

/** Aplica una solicitud aprobada dentro de la transacción `db`. Devuelve la fila resultante. */
export async function aplicarSolicitud(db, sol, user, req) {
  const actual = await cargarEntidad(db, sol.entity_type, sol.entity_id, { bloquear: true });
  if (!actual) fallo(409, "El elemento ya no existe; rechaza la solicitud.");
  const base = { db, user, entityType: sol.entity_type, entityId: sol.entity_id, req };

  if (sol.entity_type === "record" && sol.action === "delete") {
    await db.query("DELETE FROM academic_records WHERE record_id = $1", [sol.entity_id]);
    await audit({ ...base, action: "reporte.eliminado", details: { solicitud: sol.request_id, reporte: actual } });
    return null;
  }

  // Se revalida contra los datos actuales por si algo cambió desde que se pidió.
  const { changes } = prepararCambios(sol.entity_type, "update", sol.changes, actual);

  if (sol.entity_type === "record") {
    const cols = Object.keys(changes);
    const { rows } = await db.query(
      `UPDATE academic_records SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")}, updated_at = now()
       WHERE record_id = $${cols.length + 1} RETURNING *`, [...Object.values(changes), sol.entity_id]);
    await audit({ ...base, action: "reporte.modificado",
      details: { solicitud: sol.request_id, antes: Object.fromEntries(cols.map((c) => [c, actual[c]])), despues: changes } });
    return rows[0];
  }

  // Perfil: el nombre vive en users; el resto en students.
  const { full_name, ...resto } = changes;
  if (full_name !== undefined)
    await db.query("UPDATE users SET full_name = $1 WHERE student_id = $2", [full_name, sol.entity_id]);
  const cols = Object.keys(resto);
  if (cols.length)
    await db.query(`UPDATE students SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(", ")} WHERE student_id = $${cols.length + 1}`,
      [...Object.values(resto), sol.entity_id]);
  await audit({ ...base, action: "perfil.modificado",
    details: { solicitud: sol.request_id, antes: Object.fromEntries(Object.keys(changes).map((c) => [c, actual[c]])), despues: changes } });
  return null;
}
