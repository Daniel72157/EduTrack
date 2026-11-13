import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import { COOKIE, verifySession } from "@/lib/auth";
import { audit } from "@/lib/audit";

export class HttpError extends Error {
  constructor(status, mensaje, extra = {}) { super(mensaje); this.status = status; this.extra = extra; }
}
export const fallo = (status, mensaje, extra) => { throw new HttpError(status, mensaje, extra); };
export const json = (data, status = 200) => Response.json(data, { status });

/** Usuario de la sesión actual (consultado en la base para respetar desactivaciones y cambios de rol) o null. */
export async function usuarioActual() {
  const s = await verifySession(cookies().get(COOKIE)?.value);
  if (!s) return null;
  const { rows } = await pool.query(
    "SELECT user_id, email, full_name, role, student_id, active, must_change_password FROM users WHERE user_id = $1", [s.sub]);
  const u = rows[0];
  return u && u.active ? u : null;
}

/**
 * Envoltorio para route handlers:
 *  - exige sesión (y uno de los `roles`, si se indica); registra en la bitácora los accesos denegados,
 *  - convierte HttpError y errores de PostgreSQL en respuestas JSON coherentes.
 * El handler recibe (req, { params, user }).
 */
export function ruta(handler, { roles = null, publica = false } = {}) {
  return async (req, ctx = {}) => {
    let user = null;
    try {
      if (!publica) {
        user = await usuarioActual();
        if (!user) return json({ ok: false, mensaje: "Sesión no válida o vencida. Vuelve a iniciar sesión." }, 401);
        if (roles && !roles.includes(user.role)) {
          await audit({ user, action: "acceso.denegado", details: { metodo: req.method, ruta: new URL(req.url).pathname }, req });
          return json({ ok: false, mensaje: "No tienes permiso para esta acción." }, 403);
        }
      }
      return await handler(req, { params: ctx.params || {}, user });
    } catch (err) {
      if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err; // señal interna de Next.js: no es un error real
      if (err instanceof HttpError) return json({ ok: false, mensaje: err.message, ...err.extra }, err.status);
      if (err?.code && /^[0-9A-Z]{5}$/.test(err.code)) // error de PostgreSQL: la base frenó la operación
        return json({ ok: false, frenadoPor: "base", regla: err.constraint || null, codigo: err.code, detalle: err.message }, 422);
      console.error(err);
      return json({ ok: false, mensaje: "Error interno del servidor" }, 500);
    }
  };
}

export async function leerJson(req) {
  try { return await req.json(); } catch { fallo(400, "El cuerpo de la petición no es JSON válido"); }
}

export function paginacion(url, porDefecto = 20, max = 100) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const size = Math.min(max, Math.max(1, Number.parseInt(url.searchParams.get("size") || String(porDefecto), 10) || porDefecto));
  return { page, size, offset: (page - 1) * size };
}
