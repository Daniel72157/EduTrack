import bcrypt from "bcryptjs";

export { COOKIE, HOME, ROLES, SESSION_HOURS, signSession, verifySession } from "@/lib/session";

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export function validarClave(p) {
  if (typeof p !== "string" || p.length < 8) return "La contraseña debe tener al menos 8 caracteres";
  if (p.length > 72) return "La contraseña admite máximo 72 caracteres";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "La contraseña debe combinar letras y números";
  return null;
}
