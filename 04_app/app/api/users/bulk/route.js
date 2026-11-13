import { pool, tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { claveTemporal, leerLista, MAX_FILAS, revisarFila } from "@/lib/cargaMasiva";
import { fallo, leerJson, ruta } from "@/lib/api";

// Carga masiva de cuentas de estudiante (administrativos). Body: { csv: "texto", dry_run: true|false }.
//  - dry_run = true: solo valida y dice qué pasaría (no crea nada).
//  - Idempotente: cargar la misma lista dos veces no crea cuentas dobles (la 2.ª vez todo sale "ya existía").
//  - Las contraseñas temporales se devuelven UNA sola vez en esta respuesta; en la base solo queda el hash bcrypt
//    y en la bitácora nunca se escribe una contraseña.
export const POST = ruta(async (req, { user }) => {
  const b = await leerJson(req);
  const simulacion = b.dry_run === true;
  const filas = leerLista(String(b.csv || ""));
  if (!filas.length) fallo(400, "La lista está vacía. Pega o sube filas con: código, nombre, correo");
  if (filas.length > MAX_FILAS) fallo(400, `Máximo ${MAX_FILAS} filas por carga (la lista trae ${filas.length}). Divídela en partes.`);

  // 1) Reglas de la fila + repetidos dentro de la propia lista.
  const pendientes = [], candidatas = [];
  const vistoId = new Map(), vistoCorreo = new Map();
  for (const f of filas) {
    const r = revisarFila(f);
    if (!r.ok) { pendientes.push(r); continue; }
    if (vistoId.has(r.student_id)) { pendientes.push({ ...r, motivo: `código repetido en la lista (ya aparece en la línea ${vistoId.get(r.student_id)})` }); continue; }
    if (vistoCorreo.has(r.email)) { pendientes.push({ ...r, motivo: `correo repetido en la lista (ya aparece en la línea ${vistoCorreo.get(r.email)})` }); continue; }
    vistoId.set(r.student_id, r.linea); vistoCorreo.set(r.email, r.linea);
    candidatas.push(r);
  }

  // 2) Reglas que dependen de la base (dos consultas para toda la lista, parametrizadas).
  const existentes = [], nuevas = [];
  if (candidatas.length) {
    const ids = candidatas.map((c) => c.student_id), correos = candidatas.map((c) => c.email);
    const [{ rows: fichas }, { rows: cuentas }] = await Promise.all([
      pool.query("SELECT student_id FROM students WHERE student_id = ANY($1)", [ids]),
      pool.query("SELECT email, student_id FROM users WHERE student_id = ANY($1) OR email = ANY($2)", [ids, correos]),
    ]);
    const fichaOk = new Set(fichas.map((f) => f.student_id));
    const porFicha = new Map(cuentas.filter((c) => c.student_id).map((c) => [c.student_id, c.email]));
    const porCorreo = new Map(cuentas.map((c) => [c.email, c.student_id]));
    for (const c of candidatas) {
      if (!fichaOk.has(c.student_id)) pendientes.push({ ...c, motivo: "la ficha del estudiante no existe" });
      else if (porFicha.get(c.student_id) === c.email) existentes.push({ ...c, motivo: "ya tenía cuenta con ese correo (no se duplicó)" });
      else if (porFicha.has(c.student_id)) pendientes.push({ ...c, motivo: `la ficha ya tiene cuenta con otro correo (${porFicha.get(c.student_id)})` });
      else if (porCorreo.has(c.email)) pendientes.push({ ...c, motivo: "ese correo ya lo usa otra cuenta" });
      else nuevas.push(c);
    }
  }
  pendientes.sort((a, b2) => a.linea - b2.linea);
  const resumen = { leidas: filas.length, creadas: nuevas.length, existentes: existentes.length, pendientes: pendientes.length };

  // 3) Simulación: no se crea nada.
  if (simulacion) {
    await audit({ user, action: "usuarios.carga_validada", details: resumen, req });
    return Response.json({ ok: true, simulacion: true, resumen, creadas: nuevas, existentes, pendientes });
  }

  // 4) Crear cuentas en UNA transacción junto con su rastro en la bitácora.
  const creadas = [];
  const hashes = [];
  for (const c of nuevas) { const clave = claveTemporal(); hashes.push({ clave, hash: await hashPassword(clave) }); }
  await tx(async (db) => {
    for (const [i, c] of nuevas.entries()) {
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, role, student_id, must_change_password)
         VALUES ($1,$2,$3,'student',$4,true) RETURNING user_id`, [c.email, hashes[i].hash, c.full_name, c.student_id]);
      await audit({ db, user, action: "usuario.creado", entityType: "user", entityId: rows[0].user_id,
        details: { email: c.email, full_name: c.full_name, role: "student", student_id: c.student_id, origen: "carga_masiva" }, req });
      creadas.push({ ...c, password: hashes[i].clave });
    }
    await audit({ db, user, action: "usuarios.carga_masiva", details: resumen, req });
  });
  return Response.json({ ok: true, simulacion: false, resumen, creadas, existentes, pendientes },
    { headers: { "Cache-Control": "no-store" } });
}, { roles: ["admin"] });
