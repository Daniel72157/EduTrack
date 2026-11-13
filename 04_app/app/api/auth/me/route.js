import { json, ruta } from "@/lib/api";

export const GET = ruta(async (_req, { user }) => json({ ok: true, usuario: user }));
