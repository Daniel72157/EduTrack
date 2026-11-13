import { SignJWT, jwtVerify } from "jose";

// Sesión = JWT firmado (HS256) en cookie httpOnly. La clave viene de AUTH_SECRET (nunca en el código).
// Este archivo no usa APIs de Node: lo importa también el middleware (runtime Edge).
export const COOKIE = "edutrack_session";
export const SESSION_HOURS = 8;
export const ROLES = ["student", "teacher", "admin"];
export const HOME = { student: "/estudiante", teacher: "/profesor", admin: "/admin" };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET no está configurada (mínimo 32 caracteres)");
  return new TextEncoder().encode(s);
}

export async function signSession(user) {
  return new SignJWT({ role: user.role, email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.user_id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

// Devuelve { sub, role, email } o null si el token falta, está vencido o fue alterado.
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}
