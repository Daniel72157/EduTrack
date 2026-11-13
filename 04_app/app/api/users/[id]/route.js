import { tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, validarClave } from "@/lib/auth";
import { limpiar, tieneCodigo } from "@/lib/validate";
import { fallo, json, leerJson, ruta } from "@/lib/api";

// Actualizar una cuenta (administrativos): activar/desactivar, cambiar nombre o restablecer contraseña.
// El rol no se cambia: un estudiante está ligado a su ficha; para otro rol se crea otra cuenta.
export const PATCH = ruta(async (req, { params, user }) => {
  if (!/^\d+$/.test(params.id)) fallo(400, "Id de usuario inválido");
  const b = await leerJson(req);
  const sets = [], vals = [], cambios = {};
  if (typeof b.active === "boolean") {
    if (String(user.user_id) === params.id && !b.active) fallo(400, "No puedes desactivar tu propia cuenta");
    vals.push(b.active); sets.push(`active = $${vals.length}`); cambios.active = b.active;
  }
  if (b.full_name !== undefined) {
    const n = limpiar(b.full_name);
    if (n.length < 2 || n.length > 120) fallo(400, "El nombre debe tener entre 2 y 120 caracteres");
    if (tieneCodigo(n)) fallo(400, "El nombre no admite etiquetas HTML ni código");
    vals.push(n); sets.push(`full_name = $${vals.length}`); cambios.full_name = n;
  }
  if (b.password !== undefined) {
    const e = validarClave(b.password);
    if (e) fallo(400, e);
    vals.push(await hashPassword(b.password)); sets.push(`password_hash = $${vals.length}`, "must_change_password = true"); cambios.password = "restablecida";
  }
  if (!sets.length) fallo(400, "Nada que actualizar");

  const u = await tx(async (db) => {
    const { rows: antes } = await db.query("SELECT full_name, active FROM users WHERE user_id = $1 FOR UPDATE", [params.id]);
    if (!antes.length) fallo(404, "La cuenta no existe");
    vals.push(params.id);
    const { rows } = await db.query(
      `UPDATE users SET ${sets.join(", ")} WHERE user_id = $${vals.length}
       RETURNING user_id, email, full_name, role, student_id, active, created_at, last_login_at`, vals);
    await audit({ db, user, action: "usuario.actualizado", entityType: "user", entityId: params.id,
      details: { antes: antes[0], cambios }, req });
    return rows[0];
  });
  return json({ ok: true, mensaje: "Cuenta actualizada", usuario: u });
}, { roles: ["admin"] });
