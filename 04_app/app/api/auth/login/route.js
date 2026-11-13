import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { COOKIE, HOME, SESSION_HOURS, signSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, leerJson, ruta } from "@/lib/api";

const MAX_FALLOS = 5, VENTANA_MIN = 15;
// Hash ficticio: si el correo no existe se compara igual, para no revelar por tiempo de respuesta qué correos existen.
const HASH_FICTICIO = "$2a$10$YqbtG7sdEjJLhhrIBuOsAuzkKVBX3sTXTcibYQtf9aV8wr1uEF6me";

export const POST = ruta(async (req) => {
  const b = await leerJson(req);
  const email = String(b.email || "").trim().toLowerCase();
  const password = String(b.password || "");
  if (!email || !password) return json({ ok: false, mensaje: "Escribe tu correo y tu contraseña" }, 400);

  // Bloqueo temporal tras varios intentos fallidos (se cuentan en la propia bitácora).
  const { rows: f } = await pool.query(
    `SELECT count(*)::int AS n FROM audit_log
     WHERE user_email = $1 AND action = 'sesion.fallida' AND at > now() - make_interval(mins => $2)`, [email, VENTANA_MIN]);
  if (f[0].n >= MAX_FALLOS) {
    await audit({ email, action: "sesion.bloqueada", details: { intentos: f[0].n }, req });
    return json({ ok: false, mensaje: `Demasiados intentos fallidos. Espera ${VENTANA_MIN} minutos e inténtalo de nuevo.` }, 429);
  }

  const { rows } = await pool.query(
    "SELECT user_id, email, password_hash, full_name, role, student_id, active FROM users WHERE email = $1", [email]);
  const u = rows[0];
  const claveOk = await verifyPassword(password, u?.password_hash || HASH_FICTICIO);
  if (!u || !claveOk || !u.active) {
    await audit({ user: u ? { user_id: u.user_id, email, role: u.role } : null, email, action: "sesion.fallida",
      details: { motivo: !u ? "correo no registrado" : !claveOk ? "contraseña incorrecta" : "cuenta desactivada" }, req });
    return json({ ok: false, mensaje: u && claveOk && !u.active ? "Tu cuenta está desactivada. Contacta a un administrativo." : "Correo o contraseña incorrectos" }, 401);
  }

  await pool.query("UPDATE users SET last_login_at = now() WHERE user_id = $1", [u.user_id]);
  await audit({ user: u, action: "sesion.iniciada", req });
  cookies().set(COOKIE, await signSession(u), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_HOURS * 3600,
  });
  return json({ ok: true, destino: HOME[u.role], usuario: { email: u.email, full_name: u.full_name, role: u.role } });
}, { publica: true });
