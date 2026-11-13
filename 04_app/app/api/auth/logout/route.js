import { cookies } from "next/headers";
import { COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { json, ruta, usuarioActual } from "@/lib/api";

export const POST = ruta(async (req) => {
  const user = await usuarioActual();
  if (user) await audit({ user, action: "sesion.cerrada", req });
  cookies().delete(COOKIE);
  return json({ ok: true });
}, { publica: true });
