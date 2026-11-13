import { pool } from "@/lib/db";
import { hashPassword, validarClave, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fallo, json, leerJson, ruta } from "@/lib/api";

// Cambiar la propia contraseña (cualquier rol). No requiere aprobación, pero queda en la bitácora.
export const POST = ruta(async (req, { user }) => {
  const b = await leerJson(req);
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE user_id = $1", [user.user_id]);
  if (!(await verifyPassword(String(b.actual || ""), rows[0].password_hash))) fallo(400, "La contraseña actual no es correcta");
  const err = validarClave(b.nueva);
  if (err) fallo(400, err);
  await pool.query("UPDATE users SET password_hash = $1, must_change_password = false WHERE user_id = $2", [await hashPassword(b.nueva), user.user_id]);
  await audit({ user, action: "clave.cambiada", entityType: "user", entityId: user.user_id, req });
  return json({ ok: true, mensaje: "Contraseña actualizada" });
});
