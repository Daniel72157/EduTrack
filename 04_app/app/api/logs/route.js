import { pool } from "@/lib/db";
import { audit } from "@/lib/audit";
import { json, paginacion, ruta } from "@/lib/api";

// Bitácora de auditoría (solo administrativos). Filtros: action (prefijo, p. ej. "solicitud."), email, role,
// entity_type, entity_id, from, to (fechas ISO). format=csv descarga hasta 10.000 filas.
export const GET = ruta(async (req, { user }) => {
  const url = new URL(req.url);
  const p = (k) => (url.searchParams.get(k) || "").trim();
  const csv = p("format") === "csv";
  const { page, size, offset } = csv ? { page: 1, size: 10000, offset: 0 } : paginacion(url, 50, 200);

  const where = [], vals = [];
  const add = (cond, v) => { vals.push(v); where.push(cond.replaceAll("?", `$${vals.length}`)); };
  if (p("action")) add("l.action LIKE ?", `${p("action").replace(/[%_\\]/g, "\\$&")}%`);
  if (p("email")) add("l.user_email ILIKE ?", `%${p("email").replace(/[%_\\]/g, "\\$&")}%`);
  if (p("role")) add("l.user_role = ?", p("role"));
  if (p("entity_type")) add("l.entity_type = ?", p("entity_type"));
  if (p("entity_id")) add("l.entity_id = ?", p("entity_id").toUpperCase());
  if (p("from") && !Number.isNaN(Date.parse(p("from")))) add("l.at >= ?::timestamptz", p("from"));
  if (p("to") && !Number.isNaN(Date.parse(p("to")))) add("l.at < ?::timestamptz + interval '1 day'", p("to"));
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [{ rows }, { rows: c }] = await Promise.all([
    pool.query(`SELECT l.* FROM audit_log l ${w} ORDER BY l.at DESC, l.log_id DESC LIMIT ${size} OFFSET ${offset}`, vals),
    pool.query(`SELECT count(*)::int AS n FROM audit_log l ${w}`, vals),
  ]);
  const filtros = Object.fromEntries([...url.searchParams].filter(([k]) => !["page", "size"].includes(k)));
  await audit({ user, action: csv ? "logs.exportados" : "logs.consultados", details: { filtros, page }, req });

  if (csv) {
    const cols = ["log_id", "at", "user_email", "user_role", "action", "entity_type", "entity_id", "ip", "details"];
    const esc = (v) => {
      let s;
      if (v == null) s = "";
      else if (v instanceof Date) s = v.toISOString();
      else if (typeof v === "object") s = JSON.stringify(v);
      else s = String(v);
      return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    };
    const body = [cols.join(","), ...rows.map((r) => cols.map((k) => esc(r[k])).join(","))].join("\n");
    return new Response("﻿" + body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="auditoria.csv"` } });
  }
  return json({ ok: true, page, size, total: c[0].n, logs: rows });
}, { roles: ["admin"] });
