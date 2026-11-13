import { randomInt } from "node:crypto";
import { limpiar, tieneCodigo } from "@/lib/validate";

// ============================================================================
// Carga masiva de cuentas de estudiantes: REGLAS DETERMINISTAS (sin IA).
//
// Por cada fila (código, nombre, correo) se aplica, en este orden, la primera regla que falle:
//   SI el código no tiene el formato STU_XXXXXX            ENTONCES pendiente "código inválido"
//   SI el nombre está vacío, es muy corto/largo o trae código ENTONCES pendiente "nombre inválido"
//   SI el correo está vacío o mal escrito                   ENTONCES pendiente "correo vacío o inválido"
//   SI el código o el correo ya aparecieron antes en la lista ENTONCES pendiente "repetido en la lista"
//   SI la ficha del estudiante no existe en la base         ENTONCES pendiente "la ficha no existe"
//   SI la ficha ya tiene cuenta con ESE correo              ENTONCES "ya existía" (no se duplica: es idempotente)
//   SI la ficha ya tiene cuenta con OTRO correo             ENTONCES pendiente
//   SI el correo ya lo usa otra cuenta                      ENTONCES pendiente
//   EN CUALQUIER OTRO CASO                                  ENTONCES se crea la cuenta con contraseña temporal
// ============================================================================

export const MAX_FILAS = 100;
const ID_RE = /^STU_[0-9A-Z]{6,}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Divide una línea CSV respetando comillas. */
function celdas(linea, sep) {
  const out = []; let cur = ""; let q = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (q) { if (c === '"' && linea[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Lee el texto CSV (con o sin encabezado; separador coma o punto y coma). Devuelve [{linea, student_id, full_name, email}]. */
export function leerLista(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).map((l, i) => ({ l, n: i + 1 })).filter((x) => x.l.trim());
  if (!lineas.length) return [];
  const sep = (lineas[0].l.match(/;/g) || []).length > (lineas[0].l.match(/,/g) || []).length ? ";" : ",";
  let orden = { student_id: 0, full_name: 1, email: 2 };
  const primera = celdas(lineas[0].l, sep).map((c) => c.trim().toLowerCase());
  const nombres = { student_id: ["student_id", "codigo", "código", "id"], full_name: ["full_name", "nombre", "name"], email: ["email", "correo"] };
  if (primera.some((c) => Object.values(nombres).flat().includes(c))) {
    const idx = (k) => primera.findIndex((c) => nombres[k].includes(c));
    orden = { student_id: idx("student_id"), full_name: idx("full_name"), email: idx("email") };
    lineas.shift();
  }
  return lineas.map(({ l, n }) => {
    const c = celdas(l, sep);
    const dato = (k) => (orden[k] >= 0 ? c[orden[k]] ?? "" : "");
    return { linea: n, student_id: dato("student_id"), full_name: dato("full_name"), email: dato("email") };
  });
}

/** Reglas que solo miran la fila (sin tocar la base). Devuelve { fila } normalizada o { motivo }. */
export function revisarFila(f) {
  const id = limpiar(f.student_id).toUpperCase();
  const nombre = limpiar(f.full_name).replace(/\s+/g, " ");
  const correo = limpiar(f.email).toLowerCase();
  const base = { linea: f.linea, student_id: id, full_name: nombre, email: correo };
  if (!ID_RE.test(id)) return { ...base, motivo: id ? "código con formato inválido (debe ser como STU_000001)" : "código vacío" };
  if (!nombre) return { ...base, motivo: "nombre vacío" };
  if (nombre.length < 2 || nombre.length > 120) return { ...base, motivo: "el nombre debe tener entre 2 y 120 caracteres" };
  if (tieneCodigo(nombre)) return { ...base, motivo: "el nombre contiene etiquetas HTML o código" };
  if (!correo || correo.length > 254 || !EMAIL_RE.test(correo)) return { ...base, motivo: correo ? "correo vacío o inválido (falta la @ o el dominio)" : "correo vacío o inválido" };
  return { ...base, ok: true };
}

/** Contraseña temporal aleatoria (criptográficamente segura), sin caracteres confusos: 9 letras + 3 dígitos. */
export function claveTemporal() {
  const L = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", D = "23456789";
  const chars = [...Array(9)].map(() => L[randomInt(L.length)]).concat([...Array(3)].map(() => D[randomInt(D.length)]));
  for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}
